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
import { isWhisperHallucination } from '@/src/lib/speech/whisperHallucinations';

// Authentic civic reporting prompt to prime Whisper's context on Kelantanese dialect phonetics
const KELANTAN_PHONETIC_PRIME = 
  "Laporan kerosakan jalan, lubang bahaya, parit longkang tersumbat, lampu padam, pokok tumbang. " +
  "Kawe nok royak masalah dekat kawase sini.";

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
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const result = await groq.audio.transcriptions.create({
          file: audioFile,
          model,
          prompt: KELANTAN_PHONETIC_PRIME,
          language: 'ms',
          response_format: 'verbose_json',
          temperature: 0.0, // deterministic greedy decoding for maximum phonetic precision
        });

        // verbose_json adds per-segment fields the SDK's Transcription type doesn't declare
        const verbose = result as { text?: unknown; segments?: { no_speech_prob?: unknown }[] };
        if (verbose && typeof verbose.text === 'string') {
          const raw = verbose.text.trim();

          // Check segment-level no_speech_prob if provided by verbose_json
          const segments = verbose.segments;
          let isSilenceProb = false;
          if (Array.isArray(segments) && segments.length > 0) {
            const highSilenceSegments = segments.filter(
              (s) => typeof s.no_speech_prob === 'number' && s.no_speech_prob > 0.6
            );
            if (highSilenceSegments.length === segments.length) {
              isSilenceProb = true;
            }
          }

          if (isSilenceProb || isWhisperHallucination(raw)) {
            transcriptionText = '';
          } else {
            transcriptionText = raw;
          }
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[suara/transcribe] Whisper model ${model} error:`, err instanceof Error ? err.message : err);
        if (err instanceof Groq.APIError && err.status === 429) {
          return NextResponse.json(
            { success: false, error: 'Had panggilan Groq Whisper dicapai. Sila tunggu sebentar.' },
            { status: 429 }
          );
        }
      }
    }

    // If text is empty (due to silence or filtered hallucination), return isSilence cleanly
    if (!transcriptionText) {
      return NextResponse.json({
        success: true,
        text: '',
        isSilence: true,
        modelUsed: 'whisper-large-v3',
      });
    }

    return NextResponse.json({
      success: true,
      text: transcriptionText,
      modelUsed: 'whisper-large-v3',
    });

  } catch (error) {
    console.error('[suara/transcribe] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: (error instanceof Error && error.message) || 'Ralat semasa memproses pengecaman suara.' },
      { status: 500 }
    );
  }
}
