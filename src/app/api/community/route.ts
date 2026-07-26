import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import { checkRateLimit } from '@/src/lib/rateLimit';


export async function GET() {
    try {
        const supabase = createClient(await cookies());
        const { data, error } = await supabase
            .from('nadi_community_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;

        // Map created_at to timestamp for frontend compatibility
        const posts = (data || []).map(p => ({
            ...p,
            timestamp: new Date(p.created_at).getTime()
        }));

        return NextResponse.json({ success: true, posts });
    } catch (err) {
        console.error('Community GET error:', err);
        return NextResponse.json({ success: false, posts: [] });
    }
}

export async function POST(request: Request) {
    try {
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'anonymous';
        const { allowed, retryAfterSeconds, message } = checkRateLimit(ip, {
            maxRequests: 5,
            windowSeconds: 60,
            blockDurationSeconds: 120,
            bucketName: 'community-post',
        });

        if (!allowed) {
            return NextResponse.json({
                success: false,
                error: message || `Sistem sedang berehat. Sila cuba lagi dalam ${retryAfterSeconds} saat.`
            }, { status: 429 });
        }

        const { content, author, type } = await request.json();
        if (!content) return NextResponse.json({ success: false, error: 'Content required.' }, { status: 400 });

        const supabase = createClient(await cookies());
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const newPost = {
            content,
            author: author || 'Anonymous Warga',
            type: type || 'general',
            upvotes: 0,
            comments: 0,
            user_id: user.id,
        };

        const { data, error } = await supabase
            .from('nadi_community_posts')
            .insert(newPost)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            post: { ...data, timestamp: new Date(data.created_at).getTime() }
        });
    } catch (error) {
        console.error('Community POST error:', error);
        return NextResponse.json({ success: false, error: 'Failed to post.' }, { status: 500 });
    }
}
