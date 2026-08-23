import { NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { checkBantuanRequestLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

// Supabase admin client (service role — bypasses RLS for anonymous bantuan ops)
function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createSupabaseClient(supabaseUrl, serviceKey);
}

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
    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('nadi_bantuan_requests')
            .select('id, poster, type, title, description, location, category, contact, fulfilled, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Bantuan GET error:', error);
            return NextResponse.json({ success: true, requests: [] });
        }

        const formatted = (data || []).map((r: any) => ({
            ...r,
            time: formatTime(new Date(r.created_at).getTime()),
        }));

        return NextResponse.json({ success: true, requests: formatted });
    } catch (error) {
        console.error('Bantuan GET error:', error);
        return NextResponse.json({ success: true, requests: [] });
    }
}

// POST /api/bantuan/requests — submit or fulfill a request
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const supabase = getAdminSupabase();

        // Fulfill action — requires secret token authorization + rate limiting
        if (body.action === 'fulfill' && body.requestId) {
            const reqId = typeof body.requestId === 'string' ? body.requestId.trim().slice(0, 100) : '';
            const providedToken = typeof body.secretToken === 'string' ? body.secretToken.trim() : '';

            // SECURITY: Rate limiting keyed on request ID (prevents automated brute-force without spoofable IP headers)
            if (fulfillRateLimit.size > 500) {
                const now = Date.now();
                for (const [id, ts] of fulfillRateLimit) {
                    if (now - ts > FULFILL_COOLDOWN_MS * 2) fulfillRateLimit.delete(id);
                }
            }
            const lastAttempt = fulfillRateLimit.get(reqId) || 0;
            if (Date.now() - lastAttempt < FULFILL_COOLDOWN_MS) {
                return NextResponse.json({ success: false, error: 'Too many requests for this item. Please wait.' }, { status: 429 });
            }
            fulfillRateLimit.set(reqId, Date.now());

            // Fetch the request including its secret_token for verification
            const { data: req, error: fetchErr } = await supabase
                .from('nadi_bantuan_requests')
                .select('id, secret_token')
                .eq('id', reqId)
                .single();

            if (fetchErr || !req) {
                return NextResponse.json({ success: false, error: 'Request not found.' }, { status: 404 });
            }

            // SECURITY: Require authorization secret token matching the created request (constant-time check)
            if (!providedToken || !req.secret_token || !safeCompare(providedToken, req.secret_token)) {
                return NextResponse.json({ success: false, error: 'Unauthorized: Valid token required to fulfill request.' }, { status: 401 });
            }

            const { error: updateErr } = await supabase
                .from('nadi_bantuan_requests')
                .update({ fulfilled: true })
                .eq('id', reqId);

            if (updateErr) {
                console.error('Bantuan fulfill error:', updateErr);
                return NextResponse.json({ success: false, error: 'Failed to fulfill request.' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        // Submit new request — with rate limiting
        const headersList = await headers();
        const ip = getClientIp(headersList);
        const limit = checkBantuanRequestLimit(ip);
        if (!limit.allowed) {
            const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
            return addRateLimitHeaders(errRes, limit);
        }

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
        const newRow = {
            secret_token: secretToken,
            poster: 'Anonymous Warga',
            type: cleanType,
            title: cleanTitle,
            description: cleanDescription,
            location: cleanLocation,
            category: cleanCategory,
            contact: cleanContact,
            fulfilled: false,
        };

        const { data: inserted, error: insertErr } = await supabase
            .from('nadi_bantuan_requests')
            .insert(newRow)
            .select()
            .single();

        if (insertErr) {
            console.error('Bantuan insert error:', insertErr);
            return NextResponse.json({ success: false, error: 'Failed to save request.' }, { status: 500 });
        }

        // Return request with secretToken only to the author upon creation
        const response = {
            ...inserted,
            secretToken: inserted.secret_token,
            time: 'Just now',
        };
        delete response.secret_token;

        return NextResponse.json({ success: true, request: response });
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
