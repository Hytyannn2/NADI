/**
 * Sensor Telemetry API
 *
 * Handles real-time river water level readings, weather telemetry, and flood status.
 * Accepts data from hardware nodes (ESP32 over Wi-Fi HTTPS) and dispatches Telegram flood alerts.
 * The database is the only source of truth: no in-memory fallback, so a DB failure is a visible 500.
 */
import { NextResponse, after } from 'next/server';
import { getAdminSupabase, safeCompare } from '@/src/lib/auth/serverAuth';
import { checkSensorLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { sendTelegramAlert } from '@/src/lib/telegram';
import { floodStatus, SENSOR_STALE_MS } from '@/src/lib/flood';

// Minimum gap between Telegram alerts per sensor (a warning -> danger escalation always sends)
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Fetches all sensors with online/offline derived from the last reading time
export async function GET() {
    try {
        const { data, error } = await getAdminSupabase().from('nadi_bencana_sensors').select('*');
        if (error) throw error;

        const now = Date.now();
        const sensorsList = (data ?? []).map((s: any) => {
            const lastReadingTs = s.last_reading ? new Date(s.last_reading).getTime() : 0;
            const isStale = !lastReadingTs || (now - lastReadingTs) > SENSOR_STALE_MS;

            // Harmonize legacy JPS 'normal' -> 'safe' and 'alert' -> 'warning' for UI consistency
            let status = s.status;
            if (status === 'normal') status = 'safe';
            if (status === 'alert') status = 'warning';

            if (isStale) {
                return {
                    ...s,
                    is_online: false,
                    status: s.status === 'sensor_fault' ? 'sensor_fault' : 'offline'
                };
            }

            return {
                ...s,
                status,
                is_online: true
            };
        });

        return NextResponse.json(
            { success: true, sensors: sensorsList },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                }
            }
        );
    } catch (err) {
        console.error('Sensors GET error:', err);
        return NextResponse.json(
            { success: false, error: 'Sensor data unavailable.' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}

// POST: Updates sensor status from a hardware node. Status is computed here from water_level,
// never taken from the device, so every node and screen uses the same thresholds (src/lib/flood.ts).
export async function POST(request: Request) {
    try {
        // 1. Hardware authentication & rate limiting
        const nodeKey = request.headers.get('x-node-key') || request.headers.get('x-device-key') || request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
        const expectedNodeKey = process.env.SENSOR_NODE_KEY || process.env.ADMIN_API_KEY || process.env.TTN_WEBHOOK_SECRET;
        const isKnownHardware = Boolean(nodeKey && expectedNodeKey && safeCompare(nodeKey, expectedNodeKey));

        // Rate limit: 120 req/min for authenticated hardware, 15 req/min for public IP
        const clientIdentifier = isKnownHardware && nodeKey ? nodeKey : getClientIp(request.headers);
        const limitResult = checkSensorLimit(clientIdentifier, isKnownHardware);

        if (!limitResult.allowed) {
            const errRes = NextResponse.json(
                { success: false, error: limitResult.message, retryAfter: limitResult.retryAfterSeconds },
                { status: 429 }
            );
            return addRateLimitHeaders(errRes, limitResult);
        }

        // In production: enforce authentication unless running strictly in local development
        const isDevMode = process.env.NODE_ENV === 'development' || (process.env.ALLOW_DEV_SIMULATION === 'true' && process.env.NODE_ENV !== 'production');
        if (!isDevMode) {
            if (!expectedNodeKey) {
                console.error('[Sensors API] FATAL: SENSOR_NODE_KEY not configured in production. Rejecting all requests.');
                return NextResponse.json({ success: false, error: 'Server misconfiguration: SENSOR_NODE_KEY required in production.' }, { status: 503 });
            }
            if (!isKnownHardware) {
                return NextResponse.json({ success: false, error: 'Unauthorized. Valid X-NODE-KEY or API key required.' }, { status: 401 });
            }
        }

        const body = await request.json();
        const { name, water_level, battery_pct, rssi_dbm, temperature_c, humidity_pct, pressure_hpa, rise_rate_cm_hr, location } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 });
        }

        const validateNum = (v: unknown, min: number, max: number): number | undefined => {
            if (v === undefined || v === null) return undefined;
            const n = Number(v);
            if (!Number.isFinite(n) || n < min || n > max) return undefined;
            return n;
        };

        // water_level is metres. Without a valid level, only a device fault report is accepted.
        const levelM = validateNum(water_level, 0, 50);
        let status: string;
        if (levelM !== undefined) {
            status = floodStatus(levelM);
        } else if (body.status === 'sensor_fault' || body.status === 'offline') {
            status = body.status;
        } else {
            return NextResponse.json({ success: false, error: 'water_level (metres, 0-50) or a sensor_fault status is required.' }, { status: 400 });
        }

        const isFault = status === 'sensor_fault' || status === 'offline';

        // Build update payload
        const updatePayload: Record<string, unknown> = {
            status,
            last_reading: new Date().toISOString(),
            is_online: !isFault,
        };
        if (levelM !== undefined) updatePayload.water_level = levelM;
        if (battery_pct !== undefined) { const v = validateNum(battery_pct, 0, 100); if (v !== undefined) updatePayload.battery_pct = v; }
        if (rssi_dbm !== undefined) { const v = validateNum(rssi_dbm, -140, 0); if (v !== undefined) updatePayload.rssi_dbm = v; }
        if (temperature_c !== undefined) { const v = validateNum(temperature_c, -50, 80); if (v !== undefined) updatePayload.temperature_c = v; }
        if (humidity_pct !== undefined) { const v = validateNum(humidity_pct, 0, 100); if (v !== undefined) updatePayload.humidity_pct = v; }
        if (pressure_hpa !== undefined) { const v = validateNum(pressure_hpa, 800, 1200); if (v !== undefined) updatePayload.pressure_hpa = v; }
        if (rise_rate_cm_hr !== undefined) { const v = validateNum(rise_rate_cm_hr, -100, 200); if (v !== undefined) updatePayload.rise_rate_cm_hr = v; }

        const supabase = getAdminSupabase();

        // Upsert sensor row in Supabase
        const { data, error } = await supabase
            .from('nadi_bencana_sensors')
            .upsert({ name, ...updatePayload }, { onConflict: 'name' })
            .select()
            .single();

        if (error || !data) {
            console.error('[Sensors API] Sensor upsert failed:', error?.message);
            return NextResponse.json({ success: false, error: 'Failed to store sensor reading.' }, { status: 500 });
        }

        // History insert and Telegram alert run after the response, but Vercel keeps the function alive for them
        if (levelM !== undefined) {
            after(async () => {
                const { error: histErr } = await supabase
                    .from('nadi_bencana_sensor_readings')
                    .insert({
                        sensor_id: data.id,
                        water_level: levelM,
                        battery_pct: updatePayload.battery_pct ?? null,
                        temperature_c: updatePayload.temperature_c ?? null,
                        humidity_pct: updatePayload.humidity_pct ?? null,
                        pressure_hpa: updatePayload.pressure_hpa ?? null,
                    });
                if (histErr) console.error('[Sensors API] History insert failed:', histErr.message);

                if (status !== 'danger' && status !== 'warning') return;
                if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

                // Claim the alert slot atomically on the sensor row, so parallel instances can't double-send
                const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
                const claimFilter = status === 'danger'
                    ? `last_alert_at.is.null,last_alert_at.lt.${cutoff},last_alert_status.eq.warning`
                    : `last_alert_at.is.null,last_alert_at.lt.${cutoff}`;
                const { data: claimed, error: claimErr } = await supabase
                    .from('nadi_bencana_sensors')
                    .update({ last_alert_at: new Date().toISOString(), last_alert_status: status })
                    .eq('id', data.id)
                    .or(claimFilter)
                    .select('id');
                if (claimErr) { console.error('[Sensors API] Alert claim failed:', claimErr.message); return; }
                if (!claimed?.length) return; // still in cooldown

                const sent = await sendTelegramAlert({
                    sensorName: name,
                    location: location || data.location || 'Kelantan',
                    waterLevelM: levelM,
                    status,
                    riseRate: (updatePayload.rise_rate_cm_hr as number) || 0,
                    batteryPct: (updatePayload.battery_pct as number) ?? null,
                    temperatureC: (updatePayload.temperature_c as number) ?? null,
                    rssiDbm: (updatePayload.rssi_dbm as number) ?? null,
                });
                // Delivery failed: release the slot so the next reading retries
                if (!sent) await supabase.from('nadi_bencana_sensors').update({ last_alert_at: null }).eq('id', data.id);
            });
        }

        const res = NextResponse.json({ success: true, sensor: data });
        return addRateLimitHeaders(res, limitResult);
    } catch (err) {
        console.error('Sensor update error:', err);
        return NextResponse.json({ success: false, error: 'Failed to process sensor payload.' }, { status: 500 });
    }
}
