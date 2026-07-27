import { NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';

// SECURITY: Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) {
            timingSafeEqual(bufA, bufA);
            return false;
        }
        return timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

// In-memory store for mutual aid requests (MVP — replace with Supabase in production)
const requestsStore: any[] = [];

// Simple in-memory rate limiter for fulfill actions
const fulfillRateLimit = new Map<string, number>();
const FULFILL_COOLDOWN_MS = 5000; // 5 seconds between fulfill attempts per IP

// Generate a cryptographically secure random ID using CSPRNG (crypto.randomUUID)
function generateSecureId(): string {
    return `req-${randomUUID()}`;
}

// SECURITY: Robust HTML entity encoding to prevent stored XSS entirely
function sanitizeString(val: unknown, maxLen = 500): string {
    if (typeof val !== 'string') return '';
    return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/`/g, '&#x60;')
        .trim()
        .slice(0, maxLen);
}

// GET /api/bantuan/requests — fetch all mutual aid requests (exclude secret tokens)
export async function GET() {
    const sorted = [...requestsStore].sort((a, b) => b.submittedAt - a.submittedAt);
    const formatted = sorted.map(({ secretToken, ...r }) => ({
        ...r,
        time: formatTime(r.submittedAt),
    }));
    return NextResponse.json({ success: true, requests: formatted });
}

// POST /api/bantuan/requests — submit or fulfill a request
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // SECURITY: Derive IP from reliable proxy headers or fallback
        const clientIp = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-real-ip') || 
                         request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 
                         '127.0.0.1';

        // Fulfill action — requires secret token authorization + rate limiting
        if (body.action === 'fulfill' && body.requestId) {
            const reqId = typeof body.requestId === 'string' ? body.requestId.trim().slice(0, 100) : '';
            const providedToken = typeof body.secretToken === 'string' ? body.secretToken.trim() : '';

            // Rate limiting by IP — clean up old entries if map grows
            if (fulfillRateLimit.size > 500) {
                const now = Date.now();
                for (const [ip, ts] of fulfillRateLimit) {
                    if (now - ts > FULFILL_COOLDOWN_MS * 2) fulfillRateLimit.delete(ip);
                }
            }
            const lastAttempt = fulfillRateLimit.get(clientIp) || 0;
            if (Date.now() - lastAttempt < FULFILL_COOLDOWN_MS) {
                return NextResponse.json({ success: false, error: 'Too many requests. Please wait.' }, { status: 429 });
            }
            fulfillRateLimit.set(clientIp, Date.now());

            const req = requestsStore.find(r => r.id === reqId);
            if (!req) {
                return NextResponse.json({ success: false, error: 'Request not found.' }, { status: 404 });
            }

            // SECURITY: Require authorization secret token matching the created request (constant-time check)
            if (!providedToken || !req.secretToken || !safeCompare(providedToken, req.secretToken)) {
                return NextResponse.json({ success: false, error: 'Unauthorized: Valid token required to fulfill request.' }, { status: 401 });
            }

            req.fulfilled = true;
            return NextResponse.json({ success: true });
        }

        // Submit new request
        const { title, description, location, category, type, contact } = body;
        
        // SECURITY: Type enforcement, length limits, and strict HTML entity encoding
        const cleanTitle = sanitizeString(title, 150);
        const cleanDescription = sanitizeString(description, 1000);
        const cleanLocation = sanitizeString(location, 150);
        const cleanCategory = sanitizeString(category, 50) || 'General';
        const cleanType = (type === 'offer' || type === 'need') ? type : 'need';
        const cleanContact = sanitizeString(contact, 100);

        if (!cleanTitle || !cleanDescription || !cleanLocation) {
            return NextResponse.json({ success: false, error: 'Missing or invalid required fields.' }, { status: 400 });
        }

        const secretToken = generateSecureId();
        const newRequest = {
            id: generateSecureId(),
            secretToken,
            poster: 'Anonymous Warga',
            type: cleanType,
            title: cleanTitle,
            description: cleanDescription,
            location: cleanLocation,
            category: cleanCategory,
            contact: cleanContact,
            submittedAt: Date.now(),
            time: 'Just now',
            fulfilled: false,
        };

        requestsStore.unshift(newRequest);
        if (requestsStore.length > 100) requestsStore.splice(100);

        // Return request with secretToken only to the author upon creation
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
