/**
 * IoT Sensor Webhook Ingestion API
 * 
 * Receives LoRaWAN / The Things Network (TTN) and direct ESP32 telemetry,
 * updates river water levels, records reading history, and triggers Telegram flood alerts.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramAlert } from '@/src/lib/telegram';
import { checkSensorLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { timingSafeEqual } from 'crypto';

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) {
            timingSafeEqual(bufA, bufA);
            return false;
        }
        return timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

// In-memory cache for replay attack prevention and Telegram alert cooldowns
const usedNonces = new Map<string, number>();
const telegramAlertCooldowns = new Map<string, { lastSent: number; lastStatus: string }>();

function cleanExpiredNonces() {
    const now = Date.now();
    for (const [nonce, expires] of usedNonces.entries()) {
        if (expires < now) usedNonces.delete(nonce);
    }
}

export async function POST(request: Request) {
    try {
        const now = Date.now();

        // Enforces max payload size of 50KB
        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > 50000) {
            return NextResponse.json({ success: false, error: 'Payload too large (max 50KB)' }, { status: 413 });
        }

        // Hardware credential validation & rate limiting
        const nodeKey = request.headers.get('x-node-key') || request.headers.get('x-device-key') || request.headers.get('x-webhook-secret');
        const expectedNodeKey = process.env.SENSOR_NODE_KEY || process.env.TTN_WEBHOOK_SECRET;
        const isKnownHardware = Boolean(nodeKey && expectedNodeKey && safeCompare(nodeKey, expectedNodeKey));

        const clientIdentifier = isKnownHardware && nodeKey ? nodeKey : getClientIp(request.headers);
        const limitResult = checkSensorLimit(clientIdentifier, isKnownHardware);

        if (!limitResult.allowed) {
            const errRes = NextResponse.json(
                { success: false, error: limitResult.message, retryAfter: limitResult.retryAfterSeconds },
                { status: 429 }
            );
            return addRateLimitHeaders(errRes, limitResult);
        }

        // Replay protection: validate timestamp freshness (max 5 minutes tolerance)
        const webhookSecret = process.env.TTN_WEBHOOK_SECRET;
        const timestampHeader = request.headers.get('x-timestamp') || request.headers.get('x-ttn-timestamp');
        const nonce = request.headers.get('x-nonce') || request.headers.get('x-signature') || request.headers.get('x-ttn-signature');

        if (timestampHeader) {
            const reqTime = parseInt(timestampHeader, 10);
            const nowSec = Math.floor(now / 1000);
            if (!isNaN(reqTime) && Math.abs(nowSec - reqTime) > 300) {
                return NextResponse.json({ success: false, error: 'Request timestamp expired or invalid' }, { status: 401 });
            }
        }

        // Replay protection: validate nonce uniqueness
        if (nonce) {
            cleanExpiredNonces();
            if (usedNonces.has(nonce)) {
                return NextResponse.json({ success: false, error: 'Replay attack detected: nonce already processed' }, { status: 409 });
            }
            usedNonces.set(nonce, now + 600000); // Stores for 10 minutes
        }

        // Webhook secret validation
        const allowUnauthenticatedDev = process.env.ALLOW_UNAUTHENTICATED_WEBHOOK_DEV === 'true';

        if (!allowUnauthenticatedDev) {
            if (!webhookSecret) {
                console.error('[Webhook] FATAL: TTN_WEBHOOK_SECRET is not set. Rejecting request.');
                return NextResponse.json({ success: false, error: 'Webhook secret not configured' }, { status: 503 });
            }
            const providedSecret = request.headers.get('x-webhook-secret') || request.headers.get('x-downlink-apikey') || '';
            if (!providedSecret || !safeCompare(providedSecret, webhookSecret)) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        const body = await request.json();

        // TTN v3 uplink message format
        const deviceIds = body.end_device_ids;
        const uplink = body.uplink_message;

        if (!deviceIds || !uplink) {
            return NextResponse.json({ success: false, error: 'Invalid TTN payload format' }, { status: 400 });
        }

        const devEui = deviceIds.dev_eui;
        const deviceId = deviceIds.device_id;

        const decoded = uplink.decoded_payload;
        if (!decoded) {
            console.warn(`[Webhook] Received raw uplink from ${devEui} but no decoded_payload. Configure a payload formatter in TTN.`);
            return NextResponse.json({ success: true, warning: 'No decoded payload — configure TTN payload formatter' });
        }

        // Extract and VALIDATE fields from the decoded payload
        const waterLevel = decoded.water_level_cm ?? decoded.water_level ?? null;
        const batteryPct = decoded.battery_pct ?? null;
        const temperatureC = decoded.temperature_c ?? null;
        const humidityPct = decoded.humidity_pct ?? null;
        const pressureHpa = decoded.pressure_hpa ?? null;
        const danger = decoded.danger ?? false;
        const rapidRise = decoded.rapid_rise ?? false;
        const rssiDbm = uplink.rx_metadata?.[0]?.rssi ?? null;

        // Input validation — reject nonsensical values
        if (waterLevel !== null && (typeof waterLevel !== 'number' || waterLevel < 0 || waterLevel > 1000)) {
            return NextResponse.json({ success: false, error: 'Invalid water_level_cm: must be 0-1000' }, { status: 400 });
        }
        if (batteryPct !== null && (typeof batteryPct !== 'number' || batteryPct < 0 || batteryPct > 100)) {
            return NextResponse.json({ success: false, error: 'Invalid battery_pct: must be 0-100' }, { status: 400 });
        }

        // Determine sensor status from the data
        let status: 'safe' | 'warning' | 'danger' = 'safe';
        if (danger || (waterLevel !== null && waterLevel >= 120)) {
            status = 'danger';
        } else if (waterLevel !== null && waterLevel >= 80) {
            status = 'warning';
        }

        // Service role client — bypasses RLS (fail fast if not configured)
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ success: false, error: 'Server misconfiguration: service role key not set' }, { status: 500 });
        }
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Step 1: Find or identify the sensor by dev_eui
        const { data: existingSensor } = await supabase
            .from('nadi_bencana_sensors')
            .select('id, name, location')
            .eq('dev_eui', devEui)
            .maybeSingle();

        let sensorId: string;

        // Build the update/insert payload with all telemetry fields
        const sensorPayload: Record<string, unknown> = {
            water_level: waterLevel,
            status,
            battery_pct: batteryPct,
            rssi_dbm: rssiDbm,
            temperature_c: temperatureC,
            humidity_pct: humidityPct,
            pressure_hpa: pressureHpa,
            is_online: true,
            last_reading: new Date().toISOString(),
        };

        if (existingSensor) {
            // Update existing sensor with latest reading
            sensorId = existingSensor.id;
            await supabase
                .from('nadi_bencana_sensors')
                .update(sensorPayload)
                .eq('id', sensorId);
        } else {
            // First uplink from this device — auto-register it
            // Name defaults to the TTN device_id (can be updated in admin later)
            const { data: newSensor, error: insertError } = await supabase
                .from('nadi_bencana_sensors')
                .insert({
                    name: deviceId || `Sensor ${devEui.slice(-4)}`,
                    location: 'Unregistered — update location',
                    dev_eui: devEui,
                    ...sensorPayload,
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('[Webhook] Failed to auto-register sensor:', insertError);
                return NextResponse.json({ success: false, error: 'Failed to register new sensor' }, { status: 500 });
            }

            sensorId = newSensor!.id;
            console.log(`[Webhook] Auto-registered new sensor: ${devEui} → ${sensorId}`);
        }

        // Step 2: Insert reading into history table
        if (waterLevel !== null) {
            const flags =
                (danger ? 0x01 : 0) |
                (rapidRise ? 0x02 : 0) |
                (decoded.battery_low ? 0x04 : 0) |
                (decoded.sensor_fault ? 0x08 : 0);

            await supabase
                .from('nadi_bencana_sensor_readings')
                .insert({
                    sensor_id: sensorId,
                    water_level: waterLevel,
                    battery_pct: batteryPct,
                    rssi_dbm: rssiDbm,
                    temperature_c: temperatureC,
                    humidity_pct: humidityPct,
                    pressure_hpa: pressureHpa,
                    flags,
                });
        }

        // Step 3: Calculate rise rate from last 6 readings (~60 min at 10min intervals)
        let riseRate = 0;
        try {
            const { data: recentReadings } = await supabase
                .from('nadi_bencana_sensor_readings')
                .select('water_level, recorded_at')
                .eq('sensor_id', sensorId)
                .order('recorded_at', { ascending: false })
                .limit(6);

            if (recentReadings && recentReadings.length >= 2) {
                const newest = recentReadings[0];
                const oldest = recentReadings[recentReadings.length - 1];
                const timeDiffHours = (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / (1000 * 60 * 60);
                if (timeDiffHours > 0) {
                    riseRate = Math.round(((newest.water_level - oldest.water_level) / timeDiffHours) * 10) / 10;
                }
            }

            // Update rise rate on the sensor record
            await supabase
                .from('nadi_bencana_sensors')
                .update({ rise_rate_cm_hr: riseRate })
                .eq('id', sensorId);
        } catch (rateErr) {
            console.warn('[Webhook] Rise rate calculation failed (non-fatal):', rateErr);
        }

        // Step 4: Send Telegram alert with 30-min cooldown guard to prevent spam
        let telegramSent = false;
        if ((status === 'danger' || status === 'warning') && waterLevel !== null) {
            const cooldownRecord = telegramAlertCooldowns.get(sensorId);
            const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
            const isStatusEscalation = cooldownRecord && cooldownRecord.lastStatus === 'warning' && status === 'danger';
            const isCooldownExpired = !cooldownRecord || (now - cooldownRecord.lastSent) > COOLDOWN_MS;

            if (isCooldownExpired || isStatusEscalation) {
                // Fetch sensor name and location
                const { data: sensorInfo } = await supabase
                    .from('nadi_bencana_sensors')
                    .select('name, location')
                    .eq('id', sensorId)
                    .single();

                const sensorName = sensorInfo?.name || deviceId || `Sensor ${devEui.slice(-4)}`;
                const location = sensorInfo?.location || 'Unknown';

                // Calculate predicted time to reach danger threshold (120 cm) if rising
                let timeToDanger: string | undefined = undefined;
                if (riseRate > 0 && waterLevel < 120) {
                    const cmRemaining = 120 - waterLevel;
                    const hoursRemaining = cmRemaining / riseRate;
                    if (hoursRemaining > 0 && hoursRemaining < 48) {
                        timeToDanger = `${hoursRemaining.toFixed(1)} jam / hours`;
                    }
                }

                // Non-blocking background dispatch to prevent TTN webhook timeouts
                sendTelegramAlert({
                    sensorName,
                    location,
                    waterLevel,
                    status,
                    riseRate,
                    batteryPct,
                    temperatureC,
                    rssiDbm,
                    timeToDanger,
                }).then(sent => {
                    if (sent) {
                        telegramAlertCooldowns.set(sensorId, { lastSent: now, lastStatus: status });
                    }
                }).catch(err => console.error('[Webhook] Telegram alert dispatch failed:', err));

                telegramSent = true;
            }
        }

        return NextResponse.json({
            success: true,
            sensor_id: sensorId,
            water_level: waterLevel,
            status,
            rise_rate_cm_hr: riseRate,
            telegram_sent: telegramSent,
        });
    } catch (err: any) {
        console.error('[Webhook] Error processing TTN uplink:', err);
        return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
    }
}

// GET /api/bencana/sensors/webhook — health check for TTN test button
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'NADI Bencana LoRaWAN Webhook',
        message: 'POST uplink messages from TTN to this endpoint',
    });
}
