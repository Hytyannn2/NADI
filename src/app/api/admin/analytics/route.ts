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

        // Parallel fetch for counts to keep it fast
        const [
            { count: usersCount },
            { count: postsCount, data: recentPosts },
            { count: jobsCount, data: allJobs },
            { data: wbReports },
        ] = await Promise.all([
            supabase.from('nadi_profiles').select('*', { count: 'exact', head: true }),
            supabase.from('nadi_community_posts').select('id, author, content, type, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
            supabase.from('nadi_bencana_jobs').select('status', { count: 'exact' }),
            supabase.from('nadi_whistleblower_reports').select('category'),
        ]);

        // Process Whistleblower Data
        const wbCategories: Record<string, number> = {};
        (wbReports || []).forEach(r => {
            wbCategories[r.category] = (wbCategories[r.category] || 0) + 1;
        });

        const wbChartData = Object.entries(wbCategories).map(([name, value]) => ({
            name: name.replace('_', ' ').toUpperCase(),
            value
        }));

        // Process Jobs Data
        let openJobs = 0;
        let acceptedJobs = 0;
        (allJobs || []).forEach(j => {
            if (j.status === 'open') openJobs++;
            if (j.status === 'accepted') acceptedJobs++;
        });

        const jobsChartData = [
            { name: 'Open SOS', value: openJobs, fill: '#ef4444' }, // Red
            { name: 'Accepted Help', value: acceptedJobs, fill: '#10b981' } // Green
        ];

        return NextResponse.json({
            success: true,
            stats: {
                users: usersCount || 0,
                posts: postsCount || 0,
                jobs: jobsCount || 0,
                reports: (wbReports || []).length
            },
            charts: {
                whistleblower: wbChartData,
                jobs: jobsChartData
            },
            recentPosts: recentPosts || []
        });

    } catch (err) {
        console.error('Analytics API error:', err);
        return NextResponse.json({ success: false, error: 'Failed to fetch analytics.' }, { status: 500 });
    }
}
