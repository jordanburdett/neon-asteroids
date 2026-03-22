import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '../game/GameEngine'
import { render, generateStarfield } from '../game/renderer'
import { GameStatus, type StarfieldStar } from '../game/types'
import { AudioEngine } from '../utils/AudioEngine'
import type { DailyWaveData } from '../game/DailyChallenge'

interface GameCanvasProps {
  dailyWave?: DailyWaveData
  onGameOver?: (score: number, wave: number, waveEmojis: string[]) => void
}

export default function GameCanvas({ dailyWave, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const starsRef = useRef<StarfieldStar[]>([])
  const rafRef = useRef<number>(0)
  const gameOverFiredRef = useRef(false)
  const [hasTouchSupport] = useState(() => 'ontouchstart' in window)

  // AudioEngine: created once via useState lazy-init, accessed via ref in effects/handlers
  const [audioInstance] = useState(() => new AudioEngine())
  const audioRef = useRef(audioInstance)
  // Track muted in React state for button re-render
  const [audioMuted, setAudioMuted] = useState(false)

  // Phase shift cooldown as React state for the mobile button overlay
  const [psCooldownFraction, setPsCooldownFraction] = useState(1)

  // Fire auto-repeat
  const fireIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    const dpr = window.devicePixelRatio || 1
    const W = 800
    const H = 600

    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    if (engineRef.current === null) {
      engineRef.current = new GameEngine()
    }
    const engine = engineRef.current

    // Load daily wave if provided
    if (dailyWave !== undefined) {
      engine.loadDailyWave(dailyWave, 3)
    }

    gameOverFiredRef.current = false

    if (starsRef.current.length === 0) {
      starsRef.current = generateStarfield()
    }

    let lastTime = 0

    function loop(time: number) {
      if (!ctx) return
      const delta = lastTime === 0 ? 16 : time - lastTime
      lastTime = time

      engine.tick(Math.min(delta, 100))  // cap at 100ms to avoid spiral of death
      const state = engine.getState()

      // Update phase shift cooldown state for mobile button
      if (state.phaseShiftStatus === 'COOLDOWN') {
        setPsCooldownFraction(state.cooldownRemaining / 10)
      } else if (state.phaseShiftStatus === 'READY') {
        setPsCooldownFraction(1)
      } else {
        setPsCooldownFraction(0)
      }

      render(ctx, state, starsRef.current, dpr)

      // Drain and route audio events
      const audio = audioRef.current
      const events = engine.drainEvents()
      for (const evt of events) {
        switch (evt.type) {
          case 'FIRE':
            audio.playFire()
            break
          case 'ASTEROID_HIT':
            audio.playAsteroidHit(evt.size)
            break
          case 'SHIP_DIE':
            audio.stopThrust()
            audio.playShipDie()
            break
          case 'WAVE_CLEAR':
            audio.playWaveClear()
            break
          case 'UFO_START':
            audio.startUFO()
            break
          case 'UFO_STOP':
            audio.stopUFO()
            break
          case 'UFO_HIT':
            audio.stopUFO()
            audio.playUFOHit()
            break
          case 'PHASE_SHIFT_ACTIVATE':
            audio.playPhaseShift()
            break
          case 'THRUST_START':
            audio.startThrust()
            break
          case 'THRUST_STOP':
            audio.stopThrust()
            break
          default:
            break
        }
      }

      // Notify parent when daily game over
      if (
        state.status === GameStatus.GAME_OVER &&
        !gameOverFiredRef.current &&
        onGameOver !== undefined
      ) {
        gameOverFiredRef.current = true
        onGameOver(state.score, state.wave, state.dailyWaveEmojis)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    function handleKeyDown(e: KeyboardEvent) {
      const eng = engineRef.current
      if (eng === null) return

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault()
          eng.rotateLeft(true)
          break
        case 'ArrowRight':
          e.preventDefault()
          eng.rotateRight(true)
          break
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault()
          eng.thrust(true)
          break
        case 'Space':
        case 'KeyZ':
          e.preventDefault()
          if (eng.getState().status === GameStatus.GAME_OVER) {
            if (dailyWave === undefined) {
              // Classic: restart with fresh engine
              engineRef.current = new GameEngine()
            }
            // Daily: don't restart — parent handles result card
          } else {
            eng.fire()
          }
          break
        case 'KeyP':
        case 'Escape':
          e.preventDefault()
          eng.togglePause()
          break
        case 'KeyH':
          e.preventDefault()
          eng.activatePhaseShift()
          break
        default:
          break
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const eng = engineRef.current
      if (eng === null) return

      switch (e.code) {
        case 'ArrowLeft':
          eng.rotateLeft(false)
          break
        case 'ArrowRight':
          eng.rotateRight(false)
          break
        case 'ArrowUp':
        case 'KeyW':
          eng.thrust(false)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [dailyWave, onGameOver])

  // ---- Mobile touch handlers ----

  // Left joystick center position constants
  const JOYSTICK_CX = 100
  const JOYSTICK_CY_FROM_BOTTOM = 120
  // Button sizes
  const FIRE_SIZE = 72
  const PS_SIZE = 64
  const PAUSE_SIZE = 44

  function stopFireRepeat() {
    if (fireIntervalRef.current !== null) {
      clearInterval(fireIntervalRef.current)
      fireIntervalRef.current = null
    }
  }

  function startFireRepeat() {
    const eng = engineRef.current
    if (eng === null) return
    eng.fire()
    stopFireRepeat()
    fireIntervalRef.current = setInterval(() => {
      const e2 = engineRef.current
      if (e2 !== null) e2.fire()
    }, 200)
  }

  function handleLeftTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    handleLeftTouchMove(e)
  }

  function handleLeftTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const eng = engineRef.current
    if (eng === null) return

    const canvas = canvasRef.current
    if (canvas === null) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = 800 / rect.width

    const joystickCY = 600 - JOYSTICK_CY_FROM_BOTTOM

    // Use first touch in left half
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i]
      const touchX = (touch.clientX - rect.left) * scaleX
      const touchY = (touch.clientY - rect.top) * scaleX

      if (touchX < 400) {
        const offsetX = touchX - JOYSTICK_CX
        const offsetY = touchY - joystickCY
        eng.rotateLeft(offsetX < -15)
        eng.rotateRight(offsetX > 15)
        eng.thrust(offsetY < -15)
        return
      }
    }
  }

  function handleLeftTouchEnd(e: React.TouchEvent) {
    e.preventDefault()
    const eng = engineRef.current
    if (eng === null) return

    const canvas = canvasRef.current
    if (canvas === null) {
      eng.rotateLeft(false)
      eng.rotateRight(false)
      eng.thrust(false)
      return
    }
    const rect = canvas.getBoundingClientRect()
    const scaleX = 800 / rect.width

    let leftTouchExists = false
    for (let i = 0; i < e.touches.length; i++) {
      const tx = (e.touches[i].clientX - rect.left) * scaleX
      if (tx < 400) { leftTouchExists = true; break }
    }
    if (!leftTouchExists) {
      eng.rotateLeft(false)
      eng.rotateRight(false)
      eng.thrust(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Neon Asteroids game canvas"
        style={{ display: 'block', background: '#000' }}
      />

      {/* Mute button — always visible */}
      <button
        aria-label={audioMuted ? 'Unmute audio' : 'Mute audio'}
        onClick={() => {
          const next = !audioMuted
          audioRef.current.muted = next
          setAudioMuted(next)
        }}
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '12px',
          padding: '4px 8px',
          cursor: 'pointer',
          letterSpacing: '1px',
          zIndex: 10,
        }}
      >
        {audioMuted ? 'SFX OFF' : 'SFX ON'}
      </button>

      {/* Mobile controls — only rendered when touch device detected */}
      {hasTouchSupport && (
        <>
          {/* Left joystick touch zone (entire left half) */}
          <div
            onTouchStart={handleLeftTouchStart}
            onTouchMove={handleLeftTouchMove}
            onTouchEnd={handleLeftTouchEnd}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '50%',
              height: '100%',
              zIndex: 5,
              touchAction: 'none',
            }}
          >
            {/* Joystick visual */}
            <div
              style={{
                position: 'absolute',
                left: `${JOYSTICK_CX}px`,
                bottom: `${JOYSTICK_CY_FROM_BOTTOM}px`,
                transform: 'translate(-50%, 50%)',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.15)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.4)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* Fire button — bottom right */}
          <button
            aria-label="Fire"
            onTouchStart={(e) => { e.preventDefault(); startFireRepeat() }}
            onTouchEnd={(e) => { e.preventDefault(); stopFireRepeat() }}
            style={{
              position: 'absolute',
              right: '20px',
              bottom: '20px',
              width: `${FIRE_SIZE}px`,
              height: `${FIRE_SIZE}px`,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '11px',
              letterSpacing: '1px',
              cursor: 'pointer',
              touchAction: 'none',
              zIndex: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            FIRE
          </button>

          {/* Phase Shift button — above Fire button */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              bottom: `${20 + FIRE_SIZE + 12}px`,
              width: `${PS_SIZE}px`,
              height: `${PS_SIZE}px`,
              zIndex: 6,
            }}
          >
            <button
              aria-label="Phase Shift"
              onTouchStart={(e) => {
                e.preventDefault()
                const eng = engineRef.current
                if (eng !== null) eng.activatePhaseShift()
              }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(0,229,255,0.08)',
                border: '2px solid rgba(0,229,255,0.3)',
                color: 'rgba(0,229,255,0.9)',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '11px',
                letterSpacing: '1px',
                cursor: 'pointer',
                touchAction: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Cooldown arc overlay using conic-gradient */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: `conic-gradient(rgba(0,0,0,0.5) ${(1 - psCooldownFraction) * 360}deg, transparent 0deg)`,
                  pointerEvents: 'none',
                }}
              />
              PS
            </button>
          </div>

          {/* Pause button — top right */}
          <button
            aria-label="Pause"
            onTouchStart={(e) => {
              e.preventDefault()
              const eng = engineRef.current
              if (eng !== null) eng.togglePause()
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: `${PAUSE_SIZE}px`,
              height: `${PAUSE_SIZE}px`,
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              touchAction: 'none',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⏸
          </button>
        </>
      )}
    </div>
  )
}
