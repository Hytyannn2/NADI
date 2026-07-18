import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/bencana/sensors — update sensor status (simulation + admin)
// Uses service role key to bypass RLS since sensor writes are now restricted
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, status, water_level, battery_pct } = body;

        if (!name || !status) {
            return NextResponse.json({ success: false, error: 'Name and status are required.' }, { status: 400 });
        }

        const validStatuses = ['safe', 'warning', 'danger'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        // Use service role to bypass RLS (sensors are now admin-write only)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Build update payload — always update status + last_reading, optionally water_level + battery
        const updatePayload: Record<string, unknown> = {
            status,
            last_reading: new Date().toISOString(),
        };
        if (water_level !== undefined) updatePayload.water_level = water_level;
        if (battery_pct !== undefined) updatePayload.battery_pct = battery_pct;

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
                });
        }

        return NextResponse.json({ success: true, sensor: data });
    } catch (err) {
        console.error('Sensor update error:', err);
        return NextResponse.json({ success: false, error: 'Failed to update sensor.' }, { status: 500 });
    }
}
