/**
 * Historical Sensor Readings API
 * 
 * Fetches time-series telemetry data for trend charts and flood graphs.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sensorId = searchParams.get('sensor_id');
        const hours = parseInt(searchParams.get('hours') || '24', 10);
        const rawLimit = parseInt(searchParams.get('limit') || '144', 10);
        const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 144, 1000);

        if (!sensorId) {
            return NextResponse.json({ success: false, error: 'sensor_id is required' }, { status: 400 });
        }

        // Public read query using standard publishable key (protected by RLS)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        );

        // Calculates starting timestamp based on requested hour window
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: readings, error } = await supabase
            .from('nadi_bencana_sensor_readings')
            .select('water_level, battery_pct, temperature_c, humidity_pct, pressure_hpa, rssi_dbm, flags, recorded_at')
            .eq('sensor_id', sensorId)
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Orders readings chronologically (oldest to newest) for chart rendering
        const chronologicalReadings = (readings || []).slice().reverse();

        return NextResponse.json({
            success: true,
            sensor_id: sensorId,
            hours,
            count: chronologicalReadings.length,
            readings: chronologicalReadings,
        });
    } catch (err: any) {
        console.error('[Readings API] Error:', err);
        return NextResponse.json({ success: false, error: 'Failed to fetch readings' }, { status: 500 });
    }
}
