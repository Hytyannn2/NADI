import { NextResponse } from 'next/server';
import { sendTelegramTest, sendTelegramAlert } from '@/src/lib/telegram';
import { timingSafeEqual } from 'crypto';

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

/**
 * GET /api/bencana/telegram/test
 *
 * Sends a test message to verify Telegram bot is configured.
 * SECURITY: Only available in development. Requires ADMIN_API_KEY in staging/preview.
 */
export async function GET(request: Request) {
    // SECURITY: Block in production, require API key in non-dev environments
    const isDev = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        return NextResponse.json({ success: false, error: 'Test endpoint disabled in production.' }, { status: 404 });
    }

    if (!isDev) {
        const adminKey = process.env.ADMIN_API_KEY;
        if (!adminKey) {
            return NextResponse.json({ success: false, error: 'Server misconfiguration: API key not set.' }, { status: 503 });
        }
        const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || '';
        if (!safeCompare(providedKey, adminKey)) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Valid API key required.' }, { status: 401 });
        }
    }

    const result = await sendTelegramTest();

    if (result.success) {
        return NextResponse.json({
            success: true,
            message: 'Test message sent to Telegram! Check your group.',
        });
    }

    return NextResponse.json({
        success: false,
        error: result.error,
        help: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local. See: https://core.telegram.org/bots#botfather',
    }, { status: 500 });
}

/**
 * POST /api/bencana/telegram/test
 *
 * Sends a simulated danger alert to test the full alert format.
 * SECURITY: Only available in development. Requires ADMIN_API_KEY in staging/preview.
 * Body (optional): { "level": 125, "status": "danger" }
 */
export async function POST(request: Request) {
    // SECURITY: Block in production, require API key in non-dev environments
    const isDev = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        return NextResponse.json({ success: false, error: 'Test endpoint disabled in production.' }, { status: 404 });
    }

    if (!isDev) {
        const adminKey = process.env.ADMIN_API_KEY;
        if (!adminKey) {
            return NextResponse.json({ success: false, error: 'Server misconfiguration: API key not set.' }, { status: 503 });
        }
        const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || '';
        if (!safeCompare(providedKey, adminKey)) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Valid API key required.' }, { status: 401 });
        }
    }

    let level = 125;
    let status: 'warning' | 'danger' = 'danger';

    try {
        const body = await request.json();
        if (body.level) level = body.level;
        if (body.status === 'warning') status = 'warning';
    } catch {
        // Use defaults
    }

    const sent = await sendTelegramAlert({
        sensorName: 'Lembah Sireh Node A (UJIAN)',
        location: 'Sungai Kelantan, Hulu — INI UJIAN SAHAJA',
        waterLevel: level,
        status,
        riseRate: 8.2,
        batteryPct: 73,
        temperatureC: 31.2,
        rssiDbm: -67,
    });

    if (sent) {
        return NextResponse.json({
            success: true,
            message: `Test ${status} alert sent to Telegram!`,
        });
    }

    return NextResponse.json({
        success: false,
        error: 'Failed to send. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local',
    }, { status: 500 });
}
