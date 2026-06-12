import { NextResponse } from 'next/server';

/**
 * POST /api/dialect/feedback
 * 
 * Receives user corrections from the Suara view and forwards them
 * to the Python dialect engine for learning.
 * 
 * Also stores in localStorage on the client side for the session,
 * but the real persistence happens in the Python engine's files.
 * 
 * Body:
 *   dialectText: string — What user said in dialect
 *   correctMeaning: string — Correct Standard Malay/English
 *   region: string — Dialect region (kelantan, terengganu, etc.)
 *   rawVoice: string — Original voice transcript
 *   reportId: string — The report this correction belongs to
 */

const DIALECT_ENGINE_URL = process.env.DIALECT_ENGINE_URL || 'http://localhost:8100';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dialectText, correctMeaning, region, rawVoice, reportId } = body;

        if (!dialectText?.trim() || !correctMeaning?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Both dialect text and correct meaning are required.' },
                { status: 400 }
            );
        }

        // Forward to Python dialect engine
        let engineResult = null;
        try {
            const res = await fetch(`${DIALECT_ENGINE_URL}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialect_text: dialectText.trim(),
                    correct_meaning: correctMeaning.trim(),
                    region: region || 'unknown',
                    raw_voice: rawVoice || '',
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (res.ok) {
                const data = await res.json();
                engineResult = data.result;
            }
        } catch (engineError) {
            // Dialect engine may not be running — that's okay
            // We still store the feedback locally
            console.warn('[dialect/feedback] Engine not reachable, storing locally only:', engineError);
        }

        return NextResponse.json({
            success: true,
            message: 'Terima kasih! Your feedback helps NADI understand dialects better.',
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

/**
 * GET /api/dialect/feedback
 * 
 * Returns dialect context for AI prompt enrichment.
 * Queries the Python engine for the compact mapping string.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || undefined;

    try {
        const res = await fetch(
            `${DIALECT_ENGINE_URL}/prompt-context${region ? `?region=${region}` : ''}`,
            { signal: AbortSignal.timeout(5000) }
        );

        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({
                success: true,
                context: data.context,
                region: data.region,
            });
        }
    } catch {
        // Engine not running — return empty context
    }

    return NextResponse.json({
        success: true,
        context: '',
        region: region || 'all',
        message: 'Dialect engine not available. AI will work without dialect context.',
    });
}
