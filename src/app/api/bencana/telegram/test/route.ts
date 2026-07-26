import { NextResponse } from 'next/server';
import { sendTelegramTest, sendTelegramAlert } from '@/src/lib/telegram';

/**
 * GET /api/bencana/telegram/test
 *
 * Sends a test message to verify Telegram bot is configured.
 * Use this to confirm your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are correct.
 */
export async function GET() {
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
 * Body (optional): { "level": 125, "status": "danger" }
 */
export async function POST(request: Request) {
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
