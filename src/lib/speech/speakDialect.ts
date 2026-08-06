export function speakDialect(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    alert('Browser anda tidak menyokong fungsi sintesis suara (Web Speech API).');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ms-MY'; // Malay locale
  utterance.pitch = 1.0;
  utterance.rate = 0.95; // Natural speaking rate

  // Fallback to Indonesian / English if ms-MY voice is unavailable
  const voices = window.speechSynthesis.getVoices();
  const msVoice = voices.find(
    v => v.lang.includes('ms') || v.lang.includes('id') || v.name.toLowerCase().includes('malay')
  );
  if (msVoice) {
    utterance.voice = msVoice;
  }

  window.speechSynthesis.speak(utterance);
}
