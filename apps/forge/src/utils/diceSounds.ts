// Dice sound effects manager for NexusForge

import diceSoundsData from '../data/diceSounds.json';

type SoundKey = '1-die' | '2-dice' | 'many-dice';

class DiceSoundManager {
  private sounds: Map<SoundKey, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.5;

  constructor() {
    this.initAudio();
  }

  /**
   * Initialize audio context and preload sounds
   */
  private initAudio(): void {
    // Create AudioContext for procedural sounds
    try {
      this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || AudioContext)();
    } catch {
      // AudioContext not supported
    }

    // Preload dice rolling MP3 files
    this.preloadSound('1-die', '/assets/dicesound/1d20Roll.mp3');
    this.preloadSound('2-dice', '/assets/dicesound/Shake2xRoll2D.mp3');
    this.preloadSound('many-dice', '/assets/dicesound/RollManyDice.mp3');

    // Load mute state from localStorage
    const storedMute = localStorage.getItem('5e-forge-sound-muted');
    if (storedMute === 'true') {
      this.muted = true;
    }
  }

  /**
   * Preload a sound file
   */
  private preloadSound(key: SoundKey, url: string): void {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = this.volume;
    this.sounds.set(key, audio);

    // Handle loading errors gracefully
    audio.addEventListener('error', () => {
    });
  }

  /**
   * Play a dice rolling sound based on number of dice
   * @param diceCount Number of dice being rolled
   */
  public playRollSound(diceCount: number): void {
    if (this.muted) return;

    // Resume AudioContext if suspended (required by modern browsers)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Resume failed, continue anyway
      });
    }

    let soundKey: SoundKey;
    if (diceCount === 1) {
      soundKey = '1-die';
    } else if (diceCount === 2) {
      soundKey = '2-dice';
    } else {
      soundKey = 'many-dice';
    }

    const sound = this.sounds.get(soundKey);
    if (sound) {
      // Clone and play to allow overlapping sounds
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume;
      clone.play().catch(() => {
        // Play failed, continue anyway
      });
    }
  }

  /**
   * Play critical success sound (procedurally generated)
   * Ascending arpeggio with sparkly overtones
   */
   public playCritSuccessSound(): void {
    if (this.muted || !this.audioContext) return;

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Resume failed, continue anyway
      });
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // C5, E5, G5, C6 - Major chord ascending arpeggio
    const notes = diceSoundsData.successNotes;

    notes.forEach((freq, i) => {
      this.playTone(ctx, freq, now + i * 0.1, 0.3, 'sine');

      // Add sparkly overtone
      this.playTone(ctx, freq * 2, now + i * 0.1, 0.15, 'sine');
    });
  }

  /**
   * Play critical failure sound (procedurally generated)
   * Descending tones with dull ending
   */
   public playCritFailureSound(): void {
    if (this.muted || !this.audioContext) return;

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Resume failed, continue anyway
      });
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // G4, E4, D4, B3 - Descending sad tones
    const notes = diceSoundsData.failureNotes;

    notes.forEach((freq, i) => {
      this.playTone(ctx, freq, now + i * 0.15, 0.4, 'triangle');
    });

    // Final dull thud
    this.playTone(ctx, 100, now + 0.6, 0.2, 'sawtooth');
  }

  /**
   * Play a single tone using Web Audio API
   * @param ctx AudioContext
   * @param frequency Frequency in Hz
   * @param time Start time
   * @param duration Duration in seconds
   * @param type Oscillator type
   */
  private playTone(
    ctx: AudioContext,
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType
  ): void {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(this.volume * 0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  /**
   * Toggle mute state
   * @returns New mute state
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('5e-forge-sound-muted', this.muted.toString());
    return this.muted;
  }

  /**
   * Set mute state
   * @param muted Whether to mute sounds
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem('5e-forge-sound-muted', muted.toString());
  }

  /**
   * Check if sounds are muted
   * @returns True if muted
   */
  public isSoundMuted(): boolean {
    return this.muted;
  }

  /**
   * Set volume level
   * @param volume Volume level (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = this.volume;
    });
  }

  /**
   * Get current volume level
   * @returns Volume level (0-1)
   */
  public getVolume(): number {
    return this.volume;
  }
}

// Export singleton instance
export const diceSounds = new DiceSoundManager();
