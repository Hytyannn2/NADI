/**
 * Civic Notifications API
 * 
 * Fetches recent broadcast alerts, council status updates, and emergency notices.
 */
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in server environment');
    }
    return createSupabaseClient(supabaseUrl, serviceKey);
}

// GET: Fetches the 20 most recent civic notifications
export async function GET() {
    try {
        const supabase = getAdminSupabase();
        const { data: notifs, error } = await supabase
            .from('nadi_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error || !notifs) {
            return NextResponse.json({ success: true, notifications: [] });
        }

        return NextResponse.json({ success: true, notifications: notifs });
    } catch {
        return NextResponse.json({ success: true, notifications: [] });
    }
}
