export const DIALECT_PHONETIC_MAP: Record<string, string> = {
  'sakit palo': 'sakit kepala',
  'palo': 'kepala',
  'demo': 'awak',
  'gok': 'tidak',
  'koho': 'banyak',
  'tido': 'tidur',
  'nawok': 'bohong',
  'bereh': 'beres',
  'oghe': 'orang',
  'kito': 'kita',
  'mace': 'macam',
  'guane': 'bagaimana',
  'bakpo': 'kenapa',
  'kawe': 'saya',
  'depe': 'depan',
  'blakang': 'belakang',
  'solek': 'kemas',
};

export function normalizeForSpeech(text: string): string {
  let normalized = text;
  for (const [dialectWord, standardWord] of Object.entries(DIALECT_PHONETIC_MAP)) {
    // Matches whole words to prevent accidental partial replacements (e.g. "demokrasi")
    const regex = new RegExp(`\\b${dialectWord}\\b`, 'gi');
    normalized = normalized.replace(regex, standardWord);
  }
  return normalized;
}

class DialectSpeechSynthesizer {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      this.voices = this.synth!.getVoices();
      if (this.voices.length > 0) {
        this.isInitialized = true;
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'onvoiceschanged' in this.synth) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  private getBestMalayVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }

    const preferredLocales = ['ms-MY', 'ms', 'id-ID', 'id'];
    for (const locale of preferredLocales) {
      const found = this.voices.find(v => v.lang.replace('_', '-').startsWith(locale));
      if (found) return found;
    }

    return null;
  }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synth) {
      alert('Sintesis suara tidak disokong pada pelayar ini.');
      return;
    }

    this.synth.cancel();

    const normalizedText = normalizeForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(normalizedText);
    utterance.rate = 0.9; // 0.9x rate for clear articulation
    utterance.pitch = 1.0;

    const bestVoice = this.getBestMalayVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang;
    } else {
      utterance.lang = 'ms-MY';
    }

    if (onEnd) utterance.onend = onEnd;

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth) this.synth.cancel();
  }
}

export const dialectTTS = new DialectSpeechSynthesizer();

export function speakDialect(text: string) {
  dialectTTS.speak(text);
}
