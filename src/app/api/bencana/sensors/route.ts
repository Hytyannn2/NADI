/**
 * Sensor Telemetry API
 * 
 * Handles real-time river water level readings, weather telemetry, and flood status.
 * Accepts data from hardware nodes (ESP32 / LoRaWAN) and dispatches Telegram flood alerts.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/src/lib/auth/serverAuth';
import { checkSensorLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { sendTelegramAlert } from '@/src/lib/telegram';

// 30-minute cooldown cache between Telegram alerts per sensor
const telegramAlertCooldowns = new Map<string, { lastSent: number; lastStatus: string }>();

// Fallback in-memory sensor state for local testing, TTN webhooks, and demo mode
declare global {
    var __NADI_SENSORS__: Record<string, any> | undefined;
}

const defaultInitialSensors: Record<string, any> = {
    "Sungai Kelantan Node A": {
        id: "node-a-01",
        name: "Sungai Kelantan Node A",
        // JPS co-location reference
        jps_station_id: "0730671WL",
        jps_station_name: "Sg. Kelantan di Tambatan D'Raja (F1)",
        district: "Kota Bharu",
        location_name: "Jambatan Sultan Yahya Petra",
        latitude: 6.116459809420322,
        longitude: 102.22825008905949,
        lora_radius_meters: 3000,
        lora_max_radius_meters: 5000,
        // Official JPS thresholds in meters
        threshold_normal: 1.00,
        threshold_alert: 3.00,
        threshold_warning: 4.00,
        threshold_danger: 5.00,
        status: "safe",
        water_level: 0.39,
        battery_pct: 100,
        rssi_dbm: -68,
        temperature_c: 28.5,
        humidity_pct: 75,
        pressure_hpa: 1012,
        rise_rate_cm_hr: 0,
        last_reading: new Date().toISOString(),
        is_online: true,
    }
};

if (!globalThis.__NADI_SENSORS__) {
    globalThis.__NADI_SENSORS__ = defaultInitialSensors;
}
const inMemorySensors = globalThis.__NADI_SENSORS__;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Local dev bridge cache: avoid querying Vercel on every single poll request
let lastBridgeFetchTime = 0;
let cachedBridgeSensors: any[] = [];

// GET: Fetches all sensors, merging Supabase records with in-memory telemetry
export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        let dbSensors: any[] = [];
        if (supabaseUrl && supabaseKey) {
            try {
                const supabase = createClient(supabaseUrl, supabaseKey);
                const { data } = await supabase.from('nadi_bencana_sensors').select('*');
                if (data && data.length > 0) dbSensors = data;
            } catch (e) { /* fallback to memory */ }
        }

        // Merge DB data with in-memory telemetry
        const mergedMap = new Map();
        Object.values(inMemorySensors).forEach(s => mergedMap.set(s.name, s));
        dbSensors.forEach(s => mergedMap.set(s.name, { ...mergedMap.get(s.name), ...s }));

        const now = Date.now();

        // In local development: if hardware is transmitting to production Vercel, bridge it locally with throttle
        const isLocalDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;
        if (isLocalDev) {
            if (now - lastBridgeFetchTime > 8000 || cachedBridgeSensors.length === 0) {
                lastBridgeFetchTime = now;
                try {
                    const prodUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nadi-alpha.vercel.app';
                    const prodRes = await fetch(`${prodUrl}/api/bencana/sensors`, { 
                        cache: 'no-store',
                        signal: AbortSignal.timeout(1800)
                    });
                    if (prodRes.ok) {
                        const prodJson = await prodRes.json();
                        if (prodJson.sensors && Array.isArray(prodJson.sensors)) {
                            cachedBridgeSensors = prodJson.sensors;
                        }
                    }
                } catch {
                    // Ignore network timeout or offline state
                }
            }

            for (const ps of cachedBridgeSensors) {
                const psTs = ps.last_reading ? new Date(ps.last_reading).getTime() : 0;
                const localTs = mergedMap.get(ps.name)?.last_reading ? new Date(mergedMap.get(ps.name).last_reading).getTime() : 0;
                // Adopt production data if it has a newer reading
                if (psTs >= localTs) {
                    mergedMap.set(ps.name, { ...mergedMap.get(ps.name), ...ps });
                }
            }
        }
        const sensorsList = Array.from(mergedMap.values()).map((s: any) => {
            const lastReadingTs = s.last_reading ? new Date(s.last_reading).getTime() : 0;
            // 120s tolerance for exhibition hall Wi-Fi jitter
            const isStale = !lastReadingTs || (now - lastReadingTs) > 120000;

            // Harmonize JPS 'normal' -> 'safe' and 'alert' -> 'warning' for UI consistency
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
            { success: true, sensors: Object.values(inMemorySensors) },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                }
            }
        );
    }
}

// POST: Updates sensor status from hardware node, simulation, or admin dashboard
export async function POST(request: Request) {
    try {
        const now = Date.now();

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
        const { name, status, water_level, battery_pct, rssi_dbm, temperature_c, humidity_pct, pressure_hpa, rise_rate_cm_hr, location } = body;

        if (!name || !status) {
            return NextResponse.json({ success: false, error: 'Name and status are required.' }, { status: 400 });
        }

        const validStatuses = ['safe', 'warning', 'danger', 'sensor_fault', 'offline'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const isFault = status === 'sensor_fault' || status === 'offline';

        // Build update payload
        const updatePayload: Record<string, unknown> = {
            status,
            last_reading: new Date().toISOString(),
            is_online: !isFault,
        };
        const validateNum = (v: unknown, min: number, max: number): number | undefined => {
            if (v === undefined || v === null) return undefined;
            const n = Number(v);
            if (!Number.isFinite(n) || n < min || n > max) return undefined;
            return n;
        };
        if (water_level !== undefined) { const v = validateNum(water_level, -1, 2000); if (v !== undefined) updatePayload.water_level = v; }
        if (battery_pct !== undefined) { const v = validateNum(battery_pct, 0, 100); if (v !== undefined) updatePayload.battery_pct = v; }
        if (rssi_dbm !== undefined) { const v = validateNum(rssi_dbm, -140, 0); if (v !== undefined) updatePayload.rssi_dbm = v; }
        if (temperature_c !== undefined) { const v = validateNum(temperature_c, -50, 80); if (v !== undefined) updatePayload.temperature_c = v; }
        if (humidity_pct !== undefined) { const v = validateNum(humidity_pct, 0, 100); if (v !== undefined) updatePayload.humidity_pct = v; }
        if (pressure_hpa !== undefined) { const v = validateNum(pressure_hpa, 800, 1200); if (v !== undefined) updatePayload.pressure_hpa = v; }
        if (rise_rate_cm_hr !== undefined) { const v = validateNum(rise_rate_cm_hr, -100, 200); if (v !== undefined) updatePayload.rise_rate_cm_hr = v; }

        // Cache telemetry in memory for instant local polling
        inMemorySensors[name] = {
            ...(inMemorySensors[name] || {}),
            ...updatePayload,
            name,
        };

        try {
            if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );

                // Upsert sensor row in Supabase
                const { data, error } = await supabase
                    .from('nadi_bencana_sensors')
                    .upsert({ name, ...updatePayload }, { onConflict: 'name' })
                    .select()
                    .single();

                if (error) {
                    console.warn('Supabase DB notice:', error.message);
                } else if (updatePayload.water_level !== undefined && data) {
                    // Record historical telemetry reading asynchronously
                    (async () => {
                        try {
                            await supabase
                                .from('nadi_bencana_sensor_readings')
                                .insert({
                                     sensor_id: data.id,
                                     water_level: updatePayload.water_level,
                                     battery_pct: updatePayload.battery_pct ?? null,
                                     temperature_c: updatePayload.temperature_c ?? null,
                                     humidity_pct: updatePayload.humidity_pct ?? null,
                                     pressure_hpa: updatePayload.pressure_hpa ?? null,
                                });
                        } catch (err) {
                            console.warn('History insert warning:', err);
                        }
                    })();

                    // Dispatch Telegram alert if river enters danger or warning status
                    if ((status === 'danger' || status === 'warning') && typeof updatePayload.water_level === 'number') {
                        const cooldownRecord = telegramAlertCooldowns.get(data.id);
                        const COOLDOWN_MS = 30 * 60 * 1000;
                        const isStatusEscalation = cooldownRecord && cooldownRecord.lastStatus === 'warning' && status === 'danger';
                        const isCooldownExpired = !cooldownRecord || (now - cooldownRecord.lastSent) > COOLDOWN_MS;

                        if (isCooldownExpired || isStatusEscalation) {
                            const riseRate = (updatePayload.rise_rate_cm_hr as number) || 0;
                            const rawLvl = updatePayload.water_level as number;
                            // Convert meters to cm if reading is <= 10m
                            const currentLvlCm = rawLvl <= 10 ? rawLvl * 100 : rawLvl;
                            const DANGER_THRESHOLD_CM = 120; // 1.20 meters
                            let timeToDanger: string | undefined = undefined;
                            if (riseRate > 0 && currentLvlCm < DANGER_THRESHOLD_CM) {
                                const cmRemaining = DANGER_THRESHOLD_CM - currentLvlCm;
                                const hoursRemaining = cmRemaining / riseRate;
                                if (hoursRemaining > 0 && hoursRemaining < 48) {
                                    timeToDanger = `${hoursRemaining.toFixed(1)} jam / hours`;
                                }
                            }

                            sendTelegramAlert({
                                sensorName: name,
                                location: location || data.location || 'Kelantan',
                                waterLevel: currentLvlCm,
                                status,
                                riseRate,
                                batteryPct: (updatePayload.battery_pct as number) ?? null,
                                temperatureC: (updatePayload.temperature_c as number) ?? null,
                                rssiDbm: (updatePayload.rssi_dbm as number) ?? null,
                                timeToDanger,
                            }).then(sent => {
                                if (sent) {
                                    telegramAlertCooldowns.set(data.id, { lastSent: now, lastStatus: status });
                                }
                            }).catch(err => console.error('[Sensors API] Telegram alert dispatch failed:', err));
                        }
                    }
                }

                if (data) {
                    const res = NextResponse.json({ success: true, sensor: data });
                    return addRateLimitHeaders(res, limitResult);
                }
            }
        } catch (dbErr) {
            console.warn('Supabase storage warning:', dbErr);
        }

        const successRes = NextResponse.json({ success: true, message: "Telemetry received", telemetry: updatePayload });
        return addRateLimitHeaders(successRes, limitResult);
    } catch (err: any) {
        console.error('Sensor update error:', err);
        return NextResponse.json({ success: false, error: 'Failed to process sensor payload.', details: err?.message || String(err) }, { status: 500 });
    }
}
