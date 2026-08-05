import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DIALECT_ENGINE_URL = process.env.DIALECT_ENGINE_URL || 'http://localhost:8100';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dialectText, correctMeaning, region, rawVoice, reportId, isPositive } = body;

        if (!dialectText?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Dialect text is required.' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // 1. Store feedback persistently in Supabase DB for AI prompt enrichment
        try {
            await supabase.from('nadi_dialect_feedback').insert({
                dialect_text: dialectText.trim(),
                correct_meaning: correctMeaning ? correctMeaning.trim() : null,
                region: region || 'kelantan',
                is_positive: isPositive ?? true,
            });
        } catch (dbErr) {
            console.warn('[dialect/feedback] Supabase insert warning:', dbErr);
        }

        // 2. Forward to Python dialect engine if active
        let engineResult = null;
        try {
            const res = await fetch(`${DIALECT_ENGINE_URL}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialect_text: dialectText.trim(),
                    correct_meaning: (correctMeaning || '').trim(),
                    region: region || 'kelantan',
                    raw_voice: rawVoice || '',
                    is_positive: isPositive ?? true,
                }),
                signal: AbortSignal.timeout(5000),
            });

            if (res.ok) {
                const data = await res.json();
                engineResult = data.result;
            }
        } catch (engineError) {
            console.warn('[dialect/feedback] Python engine offline, saved to Supabase DB:', engineError);
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
