import { NextResponse } from 'next/server';

const feedStore: any[] = [];

export async function GET() {
    const sorted = [...feedStore].sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json({ success: true, posts: sorted.slice(0, 30) });
}

export async function POST(request: Request) {
    try {
        const { content, author, type } = await request.json();
        if (!content) return NextResponse.json({ success: false, error: 'Content required.' }, { status: 400 });
        const post = {
            id: `post-${Date.now()}`,
            content,
            author: author || 'Anonymous Warga',
            type: type || 'general',
            timestamp: Date.now(),
            upvotes: 0,
            comments: 0,
        };
        feedStore.unshift(post);
        if (feedStore.length > 100) feedStore.splice(100);
        return NextResponse.json({ success: true, post });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to post.' }, { status: 500 });
    }
}
