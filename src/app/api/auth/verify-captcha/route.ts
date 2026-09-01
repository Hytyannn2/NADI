/**
 * Cloudflare Turnstile CAPTCHA Server-Side Verification
 * 
 * Validates the Turnstile token sent from the client against
 * Cloudflare's siteverify endpoint. Must be called before any
 * sensitive auth operation (signup, login).
 */
import { NextResponse, type NextRequest } from 'next/server';

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing CAPTCHA token' },
        { status: 400 }
      );
    }

    if (!TURNSTILE_SECRET_KEY) {
      // If no secret key configured, skip verification (dev mode)
      console.warn('[CAPTCHA] TURNSTILE_SECRET_KEY not set — skipping verification');
      return NextResponse.json({ success: true, skipped: true });
    }

    const verifyRes = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'CAPTCHA verification failed', codes: result['error-codes'] },
      { status: 403 }
    );
  } catch (err: any) {
    console.error('[CAPTCHA] Verification error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal verification error' },
      { status: 500 }
    );
  }
}
