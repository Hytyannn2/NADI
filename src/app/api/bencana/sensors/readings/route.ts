import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/bencana/sensors/readings
 *
 * Returns historical sensor readings for the 24-hour trend chart.
 *
 * Query params:
 *   sensor_id (required) — UUID of the sensor
 *   hours (optional, default 24) — how many hours of history to return
 *   limit (optional, default 144) — max rows (144 = 10-min intervals × 24h)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sensorId = searchParams.get('sensor_id');
        const hours = parseInt(searchParams.get('hours') || '24', 10);
        const limit = parseInt(searchParams.get('limit') || '144', 10);

        if (!sensorId) {
            return NextResponse.json({ success: false, error: 'sensor_id is required' }, { status: 400 });
        }

        // Public read endpoint — use publishable key (RLS allows SELECT for all)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        );

        // Calculate the cutoff time
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: readings, error } = await supabase
            .from('nadi_bencana_sensor_readings')
            .select('water_level, battery_pct, temperature_c, humidity_pct, pressure_hpa, rssi_dbm, flags, recorded_at')
            .eq('sensor_id', sensorId)
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: true })
            .limit(limit);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            sensor_id: sensorId,
            hours,
            count: readings?.length || 0,
            readings: readings || [],
        });
    } catch (err: any) {
        console.error('[Readings API] Error:', err);
        return NextResponse.json({ success: false, error: 'Failed to fetch readings' }, { status: 500 });
    }
}
