/**
 * Speech-to-Text Transcription API with Kelantanese Dialect Phonetic Priming
 * 
 * Powered by Groq Whisper Large-v3 with conversational acoustic priming to accurately
 * capture authentic Kelantanese Malay phonetics without forcing standard Malay conversions.
 */
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkSuaraLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

// Authentic conversational Kelantanese speech prompt used to prime Whisper's previous-dialogue context
const KELANTAN_PHONETIC_PRIME = 
  "Assalamualaikum, kawe nok royak masalah sikit ni. " +
  "Dekat kawase sini banyok hal hok tok selesai lagi, bahayo ko ore ramai. " +
  "Harap pihak berkuasa pakat mari tengok dan tolong selesaikan cepat deh.";

export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const limit = checkSuaraLimit(ip);
  if (!limit.allowed) {
    const errRes = NextResponse.json(
      { success: false, error: limit.message, retryAfter: limit.retryAfterSeconds },
      { status: 429 }
    );
    return addRateLimitHeaders(errRes, limit);
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File | null;

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'Fail audio diperlukan.' },
        { status: 400 }
      );
    }

    // Guard: Audio file size limits (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Saiz audio melebihi had maksimum 25MB.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Kunci API Groq tidak dikonfigurasikan.' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey });

    // Try primary model (whisper-large-v3) with fallback to (whisper-large-v3-turbo)
    const candidateModels = ['whisper-large-v3', 'whisper-large-v3-turbo'];
    let transcriptionText = '';
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const result = await groq.audio.transcriptions.create({
          file: audioFile,
          model,
          prompt: KELANTAN_PHONETIC_PRIME,
          language: 'ms',
          response_format: 'json',
          temperature: 0.0, // deterministic greedy decoding for maximum phonetic precision
        });

        if (result && typeof result.text === 'string') {
          transcriptionText = result.text.trim();
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[suara/transcribe] Whisper model ${model} error:`, err?.message || err);
        if (err?.status === 429) {
          return NextResponse.json(
            { success: false, error: 'Had panggilan Groq Whisper dicapai. Sila tunggu sebentar.' },
            { status: 429 }
          );
        }
      }
    }

    if (!transcriptionText) {
      throw lastError || new Error('Gagal mengecam audio melalui model Whisper.');
    }

    return NextResponse.json({
      success: true,
      text: transcriptionText,
      modelUsed: 'whisper-large-v3',
    });

  } catch (error: any) {
    console.error('[suara/transcribe] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Ralat semasa memproses pengecaman suara.' },
      { status: 500 }
    );
  }
}
