import { NextResponse } from 'next/server';
import { addCorrection, exportForPrompt } from '@/src/lib/dialect/engine';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dialectText, correctMeaning, region, reportId } = body;

        if (!dialectText?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Dialect text is required.' },
                { status: 400 }
            );
        }

        // Use the native TypeScript dialect engine to persist the correction
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

/**
 * GET /api/dialect/feedback
 * 
 * Returns dialect context for AI prompt enrichment.
 * Uses the native TypeScript engine directly — no Python needed.
 */
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

