import { NextResponse } from 'next/server';

// In-memory store for mutual aid requests (MVP — replace with Supabase in production)
const requestsStore: any[] = [];

// GET /api/bantuan/requests — fetch all mutual aid requests
export async function GET() {
    const sorted = [...requestsStore].sort((a, b) => b.submittedAt - a.submittedAt);
    const formatted = sorted.map(r => ({
        ...r,
        time: formatTime(r.submittedAt),
    }));
    return NextResponse.json({ success: true, requests: formatted });
}

// POST /api/bantuan/requests — submit or fulfill a request
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Fulfill action
        if (body.action === 'fulfill' && body.requestId) {
            const req = requestsStore.find(r => r.id === body.requestId);
            if (req) {
                req.fulfilled = true;
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ success: false, error: 'Request not found.' }, { status: 404 });
        }

        // Submit new request
        const { title, description, location, category, type, contact } = body;
        if (!title || !description || !location) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        const newRequest = {
            id: `bantuan-${Date.now()}`,
            poster: 'Anonymous Warga',
            type: type || 'need',
            title,
            description,
            location,
            category: category || 'General',
            contact: contact || '',
            submittedAt: Date.now(),
            time: 'Just now',
            fulfilled: false,
        };

        requestsStore.unshift(newRequest);
        if (requestsStore.length > 100) requestsStore.splice(100);

        return NextResponse.json({ success: true, request: newRequest });
    } catch (error) {
        console.error('Bantuan request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process request.' }, { status: 500 });
    }
}

function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}
