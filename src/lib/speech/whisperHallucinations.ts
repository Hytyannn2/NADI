/**
 * Whisper Hallucination Filter & Guard
 * 
 * Prevents YouTube outro and silent-audio hallucinations commonly output by
 * Whisper models when processing silent or low-volume audio in Malay, Indonesian, and English.
 */

export const WHISPER_HALLUCINATION_PATTERNS: RegExp[] = [
  /terima kasih (kerana|sebab|telah|sudah|sudi)?\s*(menonton|tengok|mendengar|hadir|luangkan|membaca)/i,
  /terima kasih\s*[.!]*$/i,
  /thank you for (watching|listening)/i,
  /thanks for (watching|listening)/i,
  /jangan lupa (untuk\s+)?(like|share|subscribe|langgan|komen)/i,
  /sila (langgan|subscribe)/i,
  /langgan saluran/i,
  /like and subscribe/i,
  /please subscribe/i,
  /subtitles by/i,
  /disediakan oleh/i,
  /dialih suara oleh/i,
  /hak cipta terpelihara/i,
  /tonton video seterusnya/i,
  /jumpa lagi di video/i,
  /sampai jumpa lagi/i,
  /selamat menonton/i,
];

/**
 * Validates whether transcribed text is a synthetic Whisper hallucination caused by silence or noise.
 */
export function isWhisperHallucination(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;

  for (const pattern of WHISPER_HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Check if after stripping the hallucination, there is any substantial content remaining
      const remaining = trimmed.replace(pattern, '').replace(/[.,!?;:\-–—\s"'()]/g, '');
      if (remaining.length < 4) {
        return true;
      }
    }
  }

  // Pure punctuation or meaningless symbols
  const nonPunct = trimmed.replace(/[.,!?;:\-–—\s"'()]/g, '');
  if (nonPunct.length === 0) return true;

  return false;
}
