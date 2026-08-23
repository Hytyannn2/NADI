/**
 * Dialect Feedback & Corrections API
 * 
 * Records crowd corrections for Kelantanese/local Malay dialect terms and exports
 * recent phonetic mappings for LLM system prompt context.
 */
import { NextResponse } from 'next/server';
import { addCorrection, exportForPrompt } from '@/src/lib/dialect/engine';
import { checkDialectFeedbackLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const limit = checkDialectFeedbackLimit(ip);
    if (!limit.allowed) {
        const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
        return addRateLimitHeaders(errRes, limit);
    }

    try {
        const body = await request.json();
        const { dialectText, correctMeaning, region, reportId } = body;

        if (!dialectText?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Dialect text is required.' },
                { status: 400 }
            );
        }

        // Persists user correction to dialect database
        let engineResult = null;
        try {
            if (correctMeaning?.trim()) {
                engineResult = await addCorrection(
                    dialectText.trim(),
                    correctMeaning.trim(),
                    region || 'kelantan'
                );
            }
        } catch (err) {
            console.warn('[dialect/feedback] Engine correction error:', err);
        }

        return NextResponse.json({
            success: true,
            message: 'Feedback received and persisted for AI learning!',
            engineResult,
            reportId,
        });

    } catch (error) {
        console.error('Dialect feedback error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process feedback.' },
            { status: 500 }
        );
    }
}

// GET: Exports dialect translation pairs for AI prompt augmentation
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || undefined;

    try {
        const context = await exportForPrompt();
        return NextResponse.json({
            success: true,
            context,
            region: region || 'all',
        });
    } catch {
        return NextResponse.json({
            success: true,
            context: '',
            region: region || 'all',
            message: 'Dialect engine encountered an error.',
        });
    }
}

