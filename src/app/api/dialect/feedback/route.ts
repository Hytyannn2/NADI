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

        const rawDialect = typeof dialectText === 'string' ? dialectText.trim() : '';
        const rawMeaning = typeof correctMeaning === 'string' ? correctMeaning.trim() : '';

        if (!rawDialect) {
            return NextResponse.json(
                { success: false, error: 'Dialect text is required.' },
                { status: 400 }
            );
        }

        // Tier 1 Ingest Gate: Length bounds
        if (rawDialect.length > 35 || rawMeaning.length > 40) {
            return NextResponse.json(
                { success: false, error: 'Teks dialek atau maksud melebihi had panjang yang dibenarkan (maksimum 35-40 aksara).' },
                { status: 400 }
            );
        }

        // Tier 1 Ingest Gate: Strict character whitelist (letters, spaces, hyphens, apostrophes)
        const VALID_DIALECT_REGEX = /^[\p{L}\s'-]+$/u;
        if (!VALID_DIALECT_REGEX.test(rawDialect) || (rawMeaning && !VALID_DIALECT_REGEX.test(rawMeaning))) {
            return NextResponse.json(
                { success: false, error: 'Hanya huruf, ruang, tanda sempang (-), dan apostrof (\') dibenarkan. Kod, simbol, atau baris baru ditolak.' },
                { status: 400 }
            );
        }

        // Tier 1 Ingest Gate: Anti-prompt-injection heuristic filter
        const FORBIDDEN_KEYWORDS = /(\bignore\b|\bsystem\b|\binstruction\b|\bprompt\b|\bbypass\b|\bjailbreak\b|\bassistant\b|\buser\b|\brule\b|\boverride\b|\bjson\b|<script|<xml|```)/i;
        if (FORBIDDEN_KEYWORDS.test(rawDialect) || FORBIDDEN_KEYWORDS.test(rawMeaning)) {
            return NextResponse.json(
                { success: false, error: 'Kandungan mengandungi perkataan atau format arahan yang dilarang.' },
                { status: 400 }
            );
        }

        // Persists vetted user correction to dialect database
        let engineResult = null;
        try {
            if (rawMeaning) {
                engineResult = await addCorrection(
                    rawDialect,
                    rawMeaning,
                    typeof region === 'string' && region.length < 20 ? region : 'kelantan'
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

