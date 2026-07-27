import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// SECURITY: Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) {
            // Compare against self to keep constant time, then return false
            timingSafeEqual(bufA, bufA);
            return false;
        }
        return timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

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
            const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || '';
            if (!safeCompare(providedKey, adminKey)) {
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
        // SECURITY: Validate telemetry fields are finite numbers within expected ranges
        const validateNum = (v: unknown, min: number, max: number): number | undefined => {
            if (v === undefined || v === null) return undefined;
            const n = Number(v);
            if (!Number.isFinite(n) || n < min || n > max) return undefined;
            return n;
        };
        if (water_level !== undefined) { const v = validateNum(water_level, 0, 2000); if (v !== undefined) updatePayload.water_level = v; }
        if (battery_pct !== undefined) { const v = validateNum(battery_pct, 0, 100); if (v !== undefined) updatePayload.battery_pct = v; }
        if (temperature_c !== undefined) { const v = validateNum(temperature_c, -50, 80); if (v !== undefined) updatePayload.temperature_c = v; }
        if (humidity_pct !== undefined) { const v = validateNum(humidity_pct, 0, 100); if (v !== undefined) updatePayload.humidity_pct = v; }
        if (pressure_hpa !== undefined) { const v = validateNum(pressure_hpa, 800, 1200); if (v !== undefined) updatePayload.pressure_hpa = v; }
        if (rise_rate_cm_hr !== undefined) { const v = validateNum(rise_rate_cm_hr, -100, 200); if (v !== undefined) updatePayload.rise_rate_cm_hr = v; }

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
