import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import { reportsStore } from '@/src/app/api/whistleblower/route';

export async function GET() {
    try {
        const supabase = createClient(await cookies());
        const { data: { user } } = await supabase.auth.getUser();

        // Security Check: Only allow logged in users for now (Admin check)
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 401 });
        }

        // Return the in-memory reports
        return NextResponse.json({ success: true, reports: reportsStore });
    } catch (err) {
        return NextResponse.json({ success: false, error: 'Failed to fetch reports.' }, { status: 500 });
    }
}
