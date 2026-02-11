// Notification sound generator using Web Audio API
// Each sound is generated programmatically - no external files needed

export type SoundKey = 'chime' | 'bell' | 'alert' | 'soft-ding' | 'triple-beep' | 'doorbell'

export const SOUND_OPTIONS: { key: SoundKey; label: string; description: string }[] = [
  { key: 'chime', label: 'Chime', description: 'A pleasant two-tone chime' },
  { key: 'bell', label: 'Bell', description: 'A warm bell tone' },
  { key: 'alert', label: 'Alert', description: 'A double-beep alert' },
  { key: 'soft-ding', label: 'Soft Ding', description: 'A gentle single ding' },
  { key: 'triple-beep', label: 'Triple Beep', description: 'Three short beeps' },
  { key: 'doorbell', label: 'Doorbell', description: 'A classic two-tone doorbell' },
]

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioCtx
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function playSound(key: SoundKey) {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  switch (key) {
    case 'chime': {
      playTone(ctx, 784, now, 0.4, 'sine', 0.25) // G5
      playTone(ctx, 1047, now + 0.15, 0.5, 'sine', 0.2) // C6
      break
    }
    case 'bell': {
      playTone(ctx, 880, now, 0.8, 'sine', 0.3) // A5
      playTone(ctx, 1760, now, 0.6, 'sine', 0.1) // A6 harmonic
      break
    }
    case 'alert': {
      playTone(ctx, 880, now, 0.15, 'square', 0.15)
      playTone(ctx, 880, now + 0.2, 0.15, 'square', 0.15)
      break
    }
    case 'soft-ding': {
      playTone(ctx, 1200, now, 0.6, 'sine', 0.2)
      break
    }
    case 'triple-beep': {
      playTone(ctx, 1000, now, 0.1, 'sine', 0.2)
      playTone(ctx, 1000, now + 0.15, 0.1, 'sine', 0.2)
      playTone(ctx, 1200, now + 0.3, 0.15, 'sine', 0.25)
      break
    }
    case 'doorbell': {
      playTone(ctx, 659, now, 0.4, 'sine', 0.3) // E5
      playTone(ctx, 523, now + 0.4, 0.6, 'sine', 0.25) // C5
      break
    }
  }
}
