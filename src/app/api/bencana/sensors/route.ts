import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/bencana/sensors — update sensor status (admin/simulation only)
// Uses service role key to bypass RLS since sensor writes are now restricted
export async function POST(request: Request) {
    try {
        const { name, status } = await request.json();

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

        const { data, error } = await supabase
            .from('nadi_bencana_sensors')
            .update({ status, last_reading: new Date().toISOString() })
            .eq('name', name)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, sensor: data });
    } catch (err) {
        console.error('Sensor update error:', err);
        return NextResponse.json({ success: false, error: 'Failed to update sensor.' }, { status: 500 });
    }
}
