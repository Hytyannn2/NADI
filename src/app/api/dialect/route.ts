/**
 * NADI Dialect Engine — Cloud-Native API Route
 * =============================================
 * Replaces the localhost:8100 Python proxy with direct TypeScript calls.
 * Works on Vercel without any external Python service.
 *
 * GET  /api/dialect?action=prompt-context  → Export dialect mappings for AI prompt
 * GET  /api/dialect?action=dictionary      → Full mapping dictionary
 * GET  /api/dialect?action=lookup&word=...  → Look up a single word
 * POST /api/dialect { action: 'translate', text: '...' }  → Translate phrase
 * POST /api/dialect { action: 'lookup', word: '...' }     → Look up a word
 * POST /api/dialect { action: 'learn', dialect: '...', standard: '...' } → RLHF correction
 */

import { NextResponse } from 'next/server';
import { lookup, translatePhrase, exportForPrompt, addCorrection, allMappings } from '@/src/lib/dialect/engine';

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const action = q.get('action') ?? 'prompt-context';

    if (action === 'prompt-context' || action === 'context') {
      return NextResponse.json({ success: true, context: await exportForPrompt() });
    }

    if (action === 'dictionary') {
      return NextResponse.json({ success: true, mappings: await allMappings() });
    }

    // Default: lookup a single word
    const word = q.get('word') ?? '';
    return NextResponse.json({ success: true, result: await lookup(word) });
  } catch (error) {
    console.error('[dialect] GET error:', error);
    return NextResponse.json({ success: false, error: 'Dialect engine error.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'translate';

    if (action === 'translate') {
      const result = await translatePhrase(body.text ?? '');
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'lookup') {
      return NextResponse.json({ success: true, result: await lookup(body.word ?? '') });
    }

    if (action === 'learn') {
      const result = await addCorrection(
        body.dialect ?? body.text ?? '',
        body.standard ?? body.meaning ?? '',
        body.region ?? 'kelantan'
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[dialect] POST error:', error);
    return NextResponse.json({ success: false, error: 'Dialect engine error.' }, { status: 500 });
  }
}
