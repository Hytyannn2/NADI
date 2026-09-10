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

declare global {
    var __NADI_SENSORS__: Record<string, any> | undefined;
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

        // Webhook secret validation (Dev bypass strictly forbidden in production)
        const isDev = process.env.NODE_ENV !== 'production';
        const allowUnauthenticatedDev = isDev && (!webhookSecret || process.env.ALLOW_UNAUTHENTICATED_WEBHOOK_DEV === 'true');

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

        // Try decoded_payload or fallback to decoding raw base64 frm_payload
        let decoded = uplink.decoded_payload;
        if (!decoded && uplink.frm_payload) {
            try {
                const buf = Buffer.from(uplink.frm_payload, 'base64');
                if (buf.length >= 2) {
                    // Default fallback decoder: 2 bytes distance/water in cm, optional 1 byte battery, optional 2 bytes temp
                    const rawCm = buf.readUInt16BE(0);
                    const bat = buf.length >= 3 ? buf.readUInt8(2) : null;
                    const temp = buf.length >= 5 ? buf.readInt16BE(3) / 10.0 : null;
                    decoded = {
                        water_level_cm: rawCm,
                        battery_pct: bat,
                        temperature_c: temp,
                    };
                    console.log(`[Webhook] Decoded raw frm_payload fallback for ${devEui}:`, decoded);
                }
            } catch (decErr) {
                console.warn('[Webhook] Failed to decode raw frm_payload:', decErr);
            }
        }

        if (!decoded) {
            console.warn(`[Webhook] Received raw uplink from ${devEui} but no decoded_payload or frm_payload. Configure a payload formatter in TTN.`);
            return NextResponse.json({ success: true, warning: 'No decoded payload — configure TTN payload formatter' });
        }

        // Extract and VALIDATE fields from the decoded payload
        const rawWater = decoded.water_level_cm ?? decoded.water_level ?? null;
        // Normalize water level: store in meters (e.g. 0.39m) for NADI UI
        const waterLevel = rawWater !== null ? (rawWater > 15 ? rawWater / 100 : rawWater) : null;
        const batteryPct = decoded.battery_pct ?? null;
        const temperatureC = decoded.temperature_c ?? null;
        const humidityPct = decoded.humidity_pct ?? null;
        const pressureHpa = decoded.pressure_hpa ?? null;
        const danger = decoded.danger ?? false;
        const rapidRise = decoded.rapid_rise ?? false;
        const rssiDbm = uplink.rx_metadata?.[0]?.rssi ?? null;

        // Input validation — reject nonsensical values
        if (rawWater !== null && (typeof rawWater !== 'number' || rawWater < 0 || rawWater > 2000)) {
            return NextResponse.json({ success: false, error: 'Invalid water level: must be 0-2000' }, { status: 400 });
        }
        if (batteryPct !== null && (typeof batteryPct !== 'number' || batteryPct < 0 || batteryPct > 100)) {
            return NextResponse.json({ success: false, error: 'Invalid battery_pct: must be 0-100' }, { status: 400 });
        }

        // Determine sensor status from the data
        let status: 'safe' | 'warning' | 'danger' = 'safe';
        const waterCm = rawWater !== null ? (rawWater <= 15 ? rawWater * 100 : rawWater) : null;
        if (danger || (waterCm !== null && waterCm >= 180)) {
            status = 'danger';
        } else if (waterCm !== null && waterCm >= 100) {
            status = 'warning';
        }

        // Step 1: Update in-memory live sensor store immediately (guarantees UI responsiveness)
        if (!globalThis.__NADI_SENSORS__) {
            globalThis.__NADI_SENSORS__ = {};
        }

        const defaultNodeKey = "Sungai Kelantan Node A";
        const targetNodeKey = globalThis.__NADI_SENSORS__[defaultNodeKey] ? defaultNodeKey : (deviceId || devEui || defaultNodeKey);
        const existingMemoryNode = globalThis.__NADI_SENSORS__[targetNodeKey] || {};

        globalThis.__NADI_SENSORS__[targetNodeKey] = {
            ...existingMemoryNode,
            id: existingMemoryNode.id || `lora-${devEui || 'node-a'}`,
            name: existingMemoryNode.name || targetNodeKey,
            location_name: existingMemoryNode.location_name || 'Jambatan Sultan Yahya Petra',
            status,
            water_level: waterLevel ?? existingMemoryNode.water_level ?? 0.39,
            battery_pct: batteryPct ?? existingMemoryNode.battery_pct ?? 100,
            rssi_dbm: rssiDbm ?? existingMemoryNode.rssi_dbm ?? -70,
            temperature_c: temperatureC ?? existingMemoryNode.temperature_c ?? 29.0,
            humidity_pct: humidityPct ?? existingMemoryNode.humidity_pct ?? 75,
            pressure_hpa: pressureHpa ?? existingMemoryNode.pressure_hpa ?? 1012,
            last_reading: new Date().toISOString(),
            is_online: true,
            dev_eui: devEui,
        };

        // Step 2: Persist to Supabase if configured (graceful error handling)
        let sensorId: string = existingMemoryNode.id || `lora-${devEui || 'node-a'}`;
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

        const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
            ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
            : null;

        if (supabase) {
            try {
                const { data: existingSensor } = await supabase
                    .from('nadi_bencana_sensors')
                    .select('id, name, location')
                    .eq('dev_eui', devEui)
                    .maybeSingle();

                if (existingSensor) {
                    sensorId = existingSensor.id;
                    await supabase
                        .from('nadi_bencana_sensors')
                        .update(sensorPayload)
                        .eq('id', sensorId);
                } else {
                    const { data: newSensor } = await supabase
                        .from('nadi_bencana_sensors')
                        .insert({
                            name: deviceId || `Sensor ${devEui.slice(-4)}`,
                            location: 'Jambatan Sultan Yahya Petra',
                            dev_eui: devEui,
                            ...sensorPayload,
                        })
                        .select('id')
                        .single();

                    if (newSensor) {
                        sensorId = newSensor.id;
                    }
                }
            } catch (dbErr) {
                console.warn('[Webhook] Supabase write skipped or blocked by RLS (using in-memory store):', dbErr);
            }
        }

        // Step 3: Insert reading into history table
        if (supabase && waterLevel !== null) {
            try {
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
            } catch (historyErr) {
                console.warn('[Webhook] History insert skipped:', historyErr);
            }
        }

        // Step 4: Calculate rise rate from last 6 readings (~60 min at 10min intervals)
        let riseRate = 0;
        if (supabase) {
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
        }

        // Step 5: Send Telegram alert with 30-min cooldown guard to prevent spam
        let telegramSent = false;
        if ((status === 'danger' || status === 'warning') && waterLevel !== null) {
            const cooldownRecord = telegramAlertCooldowns.get(sensorId);
            const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
            const isStatusEscalation = cooldownRecord && cooldownRecord.lastStatus === 'warning' && status === 'danger';
            const isCooldownExpired = !cooldownRecord || (now - cooldownRecord.lastSent) > COOLDOWN_MS;

            if (isCooldownExpired || isStatusEscalation) {
                let sensorName = deviceId || `Sensor ${devEui.slice(-4)}`;
                let location = 'Jambatan Sultan Yahya Petra';

                if (supabase) {
                    try {
                        const { data: sensorInfo } = await supabase
                            .from('nadi_bencana_sensors')
                            .select('name, location')
                            .eq('id', sensorId)
                            .single();

                        if (sensorInfo?.name) sensorName = sensorInfo.name;
                        if (sensorInfo?.location) location = sensorInfo.location;
                    } catch { /* use default */ }
                }

                // Calculate predicted time to reach danger threshold (1.8m / 180cm) if rising
                let timeToDanger: string | undefined = undefined;
                if (riseRate > 0 && waterLevel < 1.8) {
                    const cmRemaining = (1.8 - waterLevel) * 100;
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
