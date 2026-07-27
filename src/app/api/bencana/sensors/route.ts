import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/bencana/sensors — update sensor status (simulation + admin)
// SECURITY: Requires ADMIN_API_KEY in production to prevent unauthorized sensor data manipulation
export async function POST(request: Request) {
    try {
        // Auth: require API key in ALL non-development environments (fail closed)
        // Only skip auth in local development (NODE_ENV === 'development')
        const isDev = process.env.NODE_ENV === 'development';
        const adminKey = process.env.ADMIN_API_KEY;
        if (!isDev) {
            if (!adminKey) {
                console.error('[Sensors] FATAL: ADMIN_API_KEY not set in non-dev environment. Rejecting request.');
                return NextResponse.json({ success: false, error: 'Server misconfiguration: API key not set.' }, { status: 503 });
            }
            const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
            if (providedKey !== adminKey) {
                return NextResponse.json({ success: false, error: 'Unauthorized. Valid API key required.' }, { status: 401 });
            }
        }

        const body = await request.json();
        const { name, status, water_level, battery_pct, temperature_c, humidity_pct, pressure_hpa, rise_rate_cm_hr } = body;

        if (!name || !status) {
            return NextResponse.json({ success: false, error: 'Name and status are required.' }, { status: 400 });
        }

        const validStatuses = ['safe', 'warning', 'danger'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        // Use service role to bypass RLS — fail fast if not configured
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ success: false, error: 'Server misconfiguration: service role key not set' }, { status: 500 });
        }
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Build update payload — always update status + last_reading, optionally telemetry fields
        const updatePayload: Record<string, unknown> = {
            status,
            last_reading: new Date().toISOString(),
            is_online: true,
        };
        if (water_level !== undefined) updatePayload.water_level = water_level;
        if (battery_pct !== undefined) updatePayload.battery_pct = battery_pct;
        if (temperature_c !== undefined) updatePayload.temperature_c = temperature_c;
        if (humidity_pct !== undefined) updatePayload.humidity_pct = humidity_pct;
        if (pressure_hpa !== undefined) updatePayload.pressure_hpa = pressure_hpa;
        if (rise_rate_cm_hr !== undefined) updatePayload.rise_rate_cm_hr = rise_rate_cm_hr;

        const { data, error } = await supabase
            .from('nadi_bencana_sensors')
            .update(updatePayload)
            .eq('name', name)
            .select()
            .single();

        if (error) throw error;

        // Also insert a reading into history if water_level was provided
        if (water_level !== undefined && data) {
            await supabase
                .from('nadi_bencana_sensor_readings')
                .insert({
                    sensor_id: data.id,
                    water_level,
                    battery_pct: battery_pct ?? null,
                    temperature_c: temperature_c ?? null,
                    humidity_pct: humidity_pct ?? null,
                    pressure_hpa: pressure_hpa ?? null,
                });
        }

        return NextResponse.json({ success: true, sensor: data });
    } catch (err) {
        console.error('Sensor update error:', err);
        return NextResponse.json({ success: false, error: 'Failed to update sensor.' }, { status: 500 });
    }
}
