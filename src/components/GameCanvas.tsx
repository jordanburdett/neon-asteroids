import { useEffect, useRef } from 'react'
import { GameEngine } from '../game/GameEngine'
import { render, generateStarfield } from '../game/renderer'
import { GameStatus, type StarfieldStar } from '../game/types'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const starsRef = useRef<StarfieldStar[]>([])
  const rafRef = useRef<number>(0)

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
      render(ctx, state, starsRef.current, dpr)

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
            engineRef.current = new GameEngine()
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
          // Phase shift — reserved for na-002
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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Neon Asteroids game canvas"
      style={{ display: 'block', background: '#000' }}
    />
  )
}
