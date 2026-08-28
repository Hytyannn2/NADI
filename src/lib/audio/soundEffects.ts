/**
 * Web Audio & Haptic Feedback Synthesizer
 * 
 * Generates lightweight synthesized sound cues (droplets, chimes, soft taps)
 * and mobile vibration feedback without external audio files.
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nadi_sound_enabled');
      this.isEnabled = saved !== null ? saved === 'true' : false;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nadi_sound_enabled', String(enabled));
    }
  }

  public isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Triggers mobile haptic vibration if supported by device.
   */
  public vibrate(ms: number = 12): void {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignored on devices that restrict vibration without user gestures
      }
    }
  }

  /**
   * Plays a subtle water drop tone for navigation and selection.
   */
  public playWaterDrop(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = 'sine';
      // Frequency drop curve modeling a water droplet
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
      this.vibrate(8);
    } catch {
      // AudioContext failsafe
    }
  }

  /**
   * Plays an ascending triad chime on successful actions (e.g. GPS lock, verification).
   */
  public playSuccessChime(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.06;
        const duration = 0.25;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.04, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });

      this.vibrate(15);
    } catch {
      // AudioContext failsafe
    }
  }

  /**
   * Plays a quick low-frequency tap for toggles and buttons.
   */
  public playSoftTap(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.03);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
      this.vibrate(6);
    } catch {
      // AudioContext failsafe
    }
  }
}

export const sound = new SoundEffectsEngine();
