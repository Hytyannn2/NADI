import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import { reportsStore } from '@/src/app/api/whistleblower/route';

export async function GET() {
    try {
        const supabase = createClient(await cookies());
        const { data: { user } } = await supabase.auth.getUser();

        // Security: Verify user is authenticated AND is an admin
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Login required.' }, { status: 401 });
        }
        const isAdmin = user.app_metadata?.role === 'admin' || user.email === process.env.ADMIN_EMAIL;
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden. Admin access required.' }, { status: 403 });
        }

        // Return the in-memory reports
        return NextResponse.json({ success: true, reports: reportsStore });
    } catch (err) {
        return NextResponse.json({ success: false, error: 'Failed to fetch reports.' }, { status: 500 });
    }
}
