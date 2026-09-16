/**
 * Civic Notifications API
 * 
 * Fetches recent broadcast alerts, council status updates, and emergency notices.
 */
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/src/lib/auth/serverAuth';

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
