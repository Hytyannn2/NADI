import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/bencana/sensors/webhook
 *
 * Receives uplink messages from The Things Network (TTN).
 * This is the bridge between the physical LoRaWAN sensors and NADI.
 *
 * TTN sends a POST here on every sensor transmission. We:
 * 1. Extract the decoded payload (water level, battery, etc.)
 * 2. Upsert the sensor's current state in nadi_bencana_sensors
 * 3. Insert a row into nadi_bencana_sensor_readings (history)
 *
 * Uses service role key — no user auth needed (machine-to-machine).
 *
 * TTN Webhook Setup:
 *   URL: https://your-domain.vercel.app/api/bencana/sensors/webhook
 *   Events: Uplink message
 *   Optional: Add X-Webhook-Secret header for auth
 */
export async function POST(request: Request) {
    try {
        // Optional: Verify webhook secret if configured
        const webhookSecret = process.env.TTN_WEBHOOK_SECRET;
        if (webhookSecret) {
            const providedSecret = request.headers.get('x-webhook-secret') || request.headers.get('x-downlink-apikey');
            if (providedSecret !== webhookSecret) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        const body = await request.json();

        // TTN v3 uplink message format
        // https://www.thethingsindustries.com/docs/the-things-stack/concepts/data-formats/#uplink-messages
        const deviceIds = body.end_device_ids;
        const uplink = body.uplink_message;

        if (!deviceIds || !uplink) {
            return NextResponse.json({ success: false, error: 'Invalid TTN payload format' }, { status: 400 });
        }

        const devEui = deviceIds.dev_eui;
        const deviceId = deviceIds.device_id; // human-readable name like "sungai-kelantan-node-a"

        // The decoded payload comes from the TTN payload formatter (JavaScript decoder)
        const decoded = uplink.decoded_payload;
        if (!decoded) {
            // Raw bytes received but no decoder configured in TTN
            // Log it but don't fail — the data is still in TTN console
            console.warn(`[Webhook] Received raw uplink from ${devEui} but no decoded_payload. Configure a payload formatter in TTN.`);
            return NextResponse.json({ success: true, warning: 'No decoded payload — configure TTN payload formatter' });
        }

        // Extract fields from the decoded payload
        // These field names match the TTN decoder function in the sensor spec
        const waterLevel = decoded.water_level_cm ?? decoded.water_level ?? null;
        const batteryPct = decoded.battery_pct ?? null;
        const danger = decoded.danger ?? false;
        const rssiDbm = uplink.rx_metadata?.[0]?.rssi ?? null;

        // Determine sensor status from the data
        let status: 'safe' | 'warning' | 'danger' = 'safe';
        if (danger || (waterLevel !== null && waterLevel >= 120)) {
            status = 'danger';
        } else if (waterLevel !== null && waterLevel >= 80) {
            status = 'warning';
        }

        // Service role client — bypasses RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Step 1: Find or identify the sensor by dev_eui
        const { data: existingSensor } = await supabase
            .from('nadi_bencana_sensors')
            .select('id')
            .eq('dev_eui', devEui)
            .maybeSingle();

        let sensorId: string;

        if (existingSensor) {
            // Update existing sensor with latest reading
            sensorId = existingSensor.id;
            await supabase
                .from('nadi_bencana_sensors')
                .update({
                    water_level: waterLevel,
                    status,
                    battery_pct: batteryPct,
                    rssi_dbm: rssiDbm,
                    is_online: true,
                    last_reading: new Date().toISOString(),
                })
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
                    water_level: waterLevel ?? 0,
                    status,
                    battery_pct: batteryPct,
                    rssi_dbm: rssiDbm,
                    is_online: true,
                    last_reading: new Date().toISOString(),
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
                (decoded.rapid_rise ? 0x02 : 0) |
                (decoded.battery_low ? 0x04 : 0) |
                (decoded.sensor_fault ? 0x08 : 0);

            await supabase
                .from('nadi_bencana_sensor_readings')
                .insert({
                    sensor_id: sensorId,
                    water_level: waterLevel,
                    battery_pct: batteryPct,
                    rssi_dbm: rssiDbm,
                    flags,
                });
        }

        return NextResponse.json({
            success: true,
            sensor_id: sensorId,
            water_level: waterLevel,
            status,
        });
    } catch (err: any) {
        console.error('[Webhook] Error processing TTN uplink:', err);
        return NextResponse.json({ success: false, error: 'Webhook processing failed', debug: err?.message || String(err) }, { status: 500 });
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
