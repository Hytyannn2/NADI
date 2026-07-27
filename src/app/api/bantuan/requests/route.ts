import { NextResponse } from 'next/server';

// In-memory store for mutual aid requests (MVP — replace with Supabase in production)
const requestsStore: any[] = [];

// Simple in-memory rate limiter for fulfill actions
const fulfillRateLimit = new Map<string, number>();
const FULFILL_COOLDOWN_MS = 5000; // 5 seconds between fulfill attempts per IP

// Generate a cryptographically random ID to prevent enumeration
function generateSecureId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'req-';
    for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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

        // Fulfill action — rate-limited to prevent abuse
        if (body.action === 'fulfill' && body.requestId) {
            // Rate limiting by IP
            const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
            const lastAttempt = fulfillRateLimit.get(clientIp) || 0;
            if (Date.now() - lastAttempt < FULFILL_COOLDOWN_MS) {
                return NextResponse.json({ success: false, error: 'Too many requests. Please wait.' }, { status: 429 });
            }
            fulfillRateLimit.set(clientIp, Date.now());

            // Clean up old rate limit entries periodically
            if (fulfillRateLimit.size > 1000) {
                const now = Date.now();
                for (const [ip, ts] of fulfillRateLimit) {
                    if (now - ts > 60000) fulfillRateLimit.delete(ip);
                }
            }

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
            id: generateSecureId(),
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
