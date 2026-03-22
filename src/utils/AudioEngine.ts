import type { AsteroidSize } from '../game/types'

export class AudioEngine {
  private ctx: AudioContext | null = null
  muted = false

  private thrustOscNode: OscillatorNode | null = null
  private thrustGainNode: GainNode | null = null
  private ufoOscNode: OscillatorNode | null = null
  private ufoGainNode: GainNode | null = null
  private ufoAltTimer: ReturnType<typeof setInterval> | null = null

  private getCtx(): AudioContext {
    if (this.ctx === null) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  startThrust(): void {
    if (this.muted) return
    if (this.thrustOscNode !== null) return  // already playing

    const ctx = this.getCtx()

    // Filtered noise oscillator ~80Hz for thrust rumble
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 80
    filter.Q.value = 8

    const gain = ctx.createGain()
    gain.gain.value = 0.18

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()

    // Store references — BufferSource is not an OscillatorNode but we can store
    // it under thrustOscNode cast as unknown for cleanup
    this.thrustOscNode = source as unknown as OscillatorNode
    this.thrustGainNode = gain
  }

  stopThrust(): void {
    if (this.thrustOscNode !== null) {
      try {
        (this.thrustOscNode as unknown as AudioBufferSourceNode).stop()
        this.thrustOscNode.disconnect()
      } catch {
        // ignore if already stopped
      }
      this.thrustOscNode = null
    }
    if (this.thrustGainNode !== null) {
      try {
        this.thrustGainNode.disconnect()
      } catch {
        // ignore
      }
      this.thrustGainNode = null
    }
  }

  playFire(): void {
    if (this.muted) return
    const ctx = this.getCtx()

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 880

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.06)
  }

  playAsteroidHit(size: AsteroidSize): void {
    if (this.muted) return
    const ctx = this.getCtx()

    const freqMap: Record<string, number> = { LARGE: 120, MEDIUM: 240, SMALL: 480 }
    const durMap: Record<string, number> = { LARGE: 0.12, MEDIUM: 0.08, SMALL: 0.05 }
    const freq = freqMap[size] ?? 240
    const dur = durMap[size] ?? 0.08

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur)
  }

  playShipDie(): void {
    if (this.muted) return
    const ctx = this.getCtx()

    // Descending noise sweep 400→80Hz over 800ms
    const bufferSize = Math.floor(ctx.sampleRate * 0.8)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8)
    filter.Q.value = 5

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
    source.stop(ctx.currentTime + 0.8)
  }

  startUFO(): void {
    if (this.muted) return
    if (this.ufoOscNode !== null) return  // already playing

    const ctx = this.getCtx()

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440

    const gain = ctx.createGain()
    gain.gain.value = 0.1

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()

    this.ufoOscNode = osc
    this.ufoGainNode = gain

    // Alternate 440/330 every 500ms
    this.ufoAltTimer = setInterval(() => {
      if (this.ufoOscNode !== null) {
        const curFreq = this.ufoOscNode.frequency.value
        this.ufoOscNode.frequency.value = curFreq === 440 ? 330 : 440
      }
    }, 500)
  }

  stopUFO(): void {
    if (this.ufoAltTimer !== null) {
      clearInterval(this.ufoAltTimer)
      this.ufoAltTimer = null
    }
    if (this.ufoOscNode !== null) {
      try {
        this.ufoOscNode.stop()
        this.ufoOscNode.disconnect()
      } catch {
        // ignore
      }
      this.ufoOscNode = null
    }
    if (this.ufoGainNode !== null) {
      try {
        this.ufoGainNode.disconnect()
      } catch {
        // ignore
      }
      this.ufoGainNode = null
    }
  }

  playUFOHit(): void {
    if (this.muted) return
    const ctx = this.getCtx()

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
  }

  playWaveClear(): void {
    if (this.muted) return
    const ctx = this.getCtx()

    // E4-G4-B4 ascending arpeggio, 120ms each
    const notes = [329.63, 392.0, 493.88]  // E4, G4, B4
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.12
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.12)
    })
  }

  playPhaseShift(): void {
    if (this.muted) return
    const ctx = this.getCtx()

    // Rising filtered noise sweep over 300ms
    const bufferSize = Math.floor(ctx.sampleRate * 0.3)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.3)
    filter.Q.value = 8

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
    source.stop(ctx.currentTime + 0.3)
  }
}
