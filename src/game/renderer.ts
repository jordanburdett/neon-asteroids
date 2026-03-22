import { GameStatus, PhaseShiftStatus, type GameState, type StarfieldStar } from './types'
import { add, scale, rotate } from '../utils/math'
import { GAME_WIDTH, GAME_HEIGHT, shipFacingVector } from './GameEngine'

const STAR_COUNT = 80
const PHOSPHOR_STROKE = '#FFFFFF'
const PHOSPHOR_GLOW = 'rgba(255,255,255,0.28)'
const PHOSPHOR_WIDTH = 1.5
const PHOSPHOR_GLOW_WIDTH = 5
const FONT = '14px "Courier New", Courier, monospace'
const PHASE_COOLDOWN_TOTAL = 10  // must match GameEngine constant

export function generateStarfield(): StarfieldStar[] {
  const stars: StarfieldStar[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
    })
  }
  return stars
}

function drawPhosphorPath(
  ctx: CanvasRenderingContext2D,
  draw: () => void
): void {
  // First pass: solid white thin line
  ctx.strokeStyle = PHOSPHOR_STROKE
  ctx.lineWidth = PHOSPHOR_WIDTH
  draw()

  // Second pass: wide semi-transparent glow
  ctx.strokeStyle = PHOSPHOR_GLOW
  ctx.lineWidth = PHOSPHOR_GLOW_WIDTH
  draw()
}

function buildPhosphorPath(
  ctx: CanvasRenderingContext2D,
  pathFn: (ctx: CanvasRenderingContext2D) => void
): void {
  drawPhosphorPath(ctx, () => {
    ctx.beginPath()
    pathFn(ctx)
    ctx.stroke()
  })
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  stars: StarfieldStar[],
  dpr: number
): void {
  const W = GAME_WIDTH
  const H = GAME_HEIGHT

  // Scale for device pixel ratio
  ctx.save()
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Starfield
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  for (const star of stars) {
    ctx.fillRect(star.x, star.y, 1, 1)
  }

  // Asteroids
  for (const ast of state.asteroids) {
    if (ast.vertices.length === 0) continue
    buildPhosphorPath(ctx, (c) => {
      const rotatedVerts = ast.vertices.map(v => rotate(v, ast.angle))
      const first = rotatedVerts[0]
      c.moveTo(ast.pos.x + first.x, ast.pos.y + first.y)
      for (let i = 1; i < rotatedVerts.length; i++) {
        const v = rotatedVerts[i]
        c.lineTo(ast.pos.x + v.x, ast.pos.y + v.y)
      }
      c.closePath()
    })
  }

  // Bullets
  for (const bullet of state.bullets) {
    const norm = {
      x: bullet.vel.x !== 0 || bullet.vel.y !== 0
        ? bullet.vel.x / Math.sqrt(bullet.vel.x ** 2 + bullet.vel.y ** 2)
        : 0,
      y: bullet.vel.x !== 0 || bullet.vel.y !== 0
        ? bullet.vel.y / Math.sqrt(bullet.vel.x ** 2 + bullet.vel.y ** 2)
        : 1,
    }
    buildPhosphorPath(ctx, (c) => {
      c.moveTo(bullet.pos.x, bullet.pos.y)
      c.lineTo(bullet.pos.x + norm.x * 8, bullet.pos.y + norm.y * 8)
    })
  }

  // Ship
  const { ship } = state
  const shouldDrawShip =
    !ship.dying &&
    (state.status === GameStatus.PLAYING ||
      state.status === GameStatus.RESPAWNING ||
      state.status === GameStatus.PAUSED) &&
    ship.blinkOn

  if (shouldDrawShip) {
    const facing = shipFacingVector(ship.angle)
    const perp = { x: -facing.y, y: facing.x }

    const nose = add(ship.pos, scale(facing, 22))
    const leftFin = add(add(ship.pos, scale(facing, -12)), scale(perp, 10))
    const rightFin = add(add(ship.pos, scale(facing, -12)), scale(perp, -10))

    buildPhosphorPath(ctx, (c) => {
      // Open triangle ship
      c.moveTo(nose.x, nose.y)
      c.lineTo(leftFin.x, leftFin.y)
      c.moveTo(nose.x, nose.y)
      c.lineTo(rightFin.x, rightFin.y)
      c.moveTo(leftFin.x, leftFin.y)
      c.lineTo(rightFin.x, rightFin.y)
    })

    // Phase shimmer ghost: third pass at offset with cyan tint when phasing
    if (ship.phasing) {
      const offsetX = 2
      ctx.strokeStyle = 'rgba(0,229,255,0.4)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(nose.x + offsetX, nose.y)
      ctx.lineTo(leftFin.x + offsetX, leftFin.y)
      ctx.moveTo(nose.x + offsetX, nose.y)
      ctx.lineTo(rightFin.x + offsetX, rightFin.y)
      ctx.moveTo(leftFin.x + offsetX, leftFin.y)
      ctx.lineTo(rightFin.x + offsetX, rightFin.y)
      ctx.stroke()
    }

    // Exhaust flame when thrusting
    if (ship.thrusting && Math.random() > 0.5) {
      const backDir = scale(facing, -1)
      const thrustBase = add(ship.pos, scale(facing, -12))
      const flameLen = 12 + Math.random() * 10
      const flameTip = add(thrustBase, scale(backDir, flameLen))
      const flameLeft = add(thrustBase, scale(perp, 5))
      const flameRight = add(thrustBase, scale(perp, -5))

      buildPhosphorPath(ctx, (c) => {
        c.moveTo(flameTip.x, flameTip.y)
        c.lineTo(flameLeft.x, flameLeft.y)
        c.moveTo(flameTip.x, flameTip.y)
        c.lineTo(flameRight.x, flameRight.y)
      })
    }
  }

  // UFO
  const { ufo } = state
  if (ufo !== null && ufo.active) {
    buildPhosphorPath(ctx, (c) => {
      // Outer ellipse: 40x12px
      c.ellipse(ufo.pos.x, ufo.pos.y, 20, 6, 0, 0, Math.PI * 2)
    })
    buildPhosphorPath(ctx, (c) => {
      // Inner dome ellipse: 22x8px, shifted up
      c.ellipse(ufo.pos.x, ufo.pos.y - 7, 11, 8, 0, Math.PI, 0)
    })
  }

  // HUD
  renderHud(ctx, state)

  // Pause overlay
  if (state.status === GameStatus.PAUSED) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '24px "Courier New", Courier, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', W / 2, H / 2)
    ctx.font = FONT
    ctx.textAlign = 'left'
  }

  // Game Over overlay
  if (state.status === GameStatus.GAME_OVER) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '32px "Courier New", Courier, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER', W / 2, H / 2 - 20)
    ctx.font = FONT
    ctx.fillText(`SCORE: ${state.score}`, W / 2, H / 2 + 16)
    if (!state.isDaily) {
      ctx.fillText('PRESS SPACE TO RESTART', W / 2, H / 2 + 40)
    }
    ctx.textAlign = 'left'
  }

  ctx.restore()
}

function renderHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const W = GAME_WIDTH

  ctx.font = FONT
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'

  // Score top-left
  ctx.fillText(`${state.score}`, 12, 22)

  // High score
  ctx.textAlign = 'center'
  ctx.fillText(`HI ${state.highScore}`, W / 2, 22)

  // Wave top-center
  if (state.isDaily) {
    ctx.fillText(`DAILY WAVE ${state.wave}`, W / 2, 40)
  } else {
    ctx.fillText(`WAVE ${state.wave}`, W / 2, 40)
  }

  // Lives as triangle icons top-right
  ctx.textAlign = 'right'
  const livesX = W - 12
  for (let i = 0; i < state.lives; i++) {
    drawLifeIcon(ctx, livesX - i * 22, 16)
  }

  // Phase shift HUD icon (bottom-left area)
  drawPhaseShiftHud(ctx, state)

  ctx.textAlign = 'left'
}

function drawPhaseShiftHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cx = 30
  const cy = GAME_HEIGHT - 30
  const r = 12

  ctx.save()

  if (state.phaseShiftStatus === PhaseShiftStatus.READY) {
    // Full circle, cyan
    ctx.strokeStyle = 'rgba(0,229,255,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    // "H" label
    ctx.fillStyle = 'rgba(0,229,255,0.9)'
    ctx.font = '10px "Courier New", Courier, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('H', cx, cy + 4)
  } else if (state.phaseShiftStatus === PhaseShiftStatus.PHASING) {
    // Pulsing cyan full circle
    ctx.strokeStyle = 'rgba(0,229,255,1.0)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,229,255,0.3)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // COOLDOWN: depleting arc
    const fraction = state.cooldownRemaining / PHASE_COOLDOWN_TOTAL
    const startAngle = -Math.PI / 2  // top
    const endAngle = startAngle + fraction * Math.PI * 2

    // Background dim circle
    ctx.strokeStyle = 'rgba(0,229,255,0.2)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    // Foreground depleting arc
    if (fraction > 0) {
      ctx.strokeStyle = 'rgba(0,229,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, endAngle)
      ctx.stroke()
    }

    // "H" label dim
    ctx.fillStyle = 'rgba(0,229,255,0.4)'
    ctx.font = '10px "Courier New", Courier, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('H', cx, cy + 4)
  }

  ctx.restore()
}

function drawLifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Small ship triangle pointing up
  ctx.strokeStyle = PHOSPHOR_STROKE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y - 8)          // nose
  ctx.lineTo(x - 5, y + 4)      // left
  ctx.moveTo(x, y - 8)
  ctx.lineTo(x + 5, y + 4)      // right
  ctx.moveTo(x - 5, y + 4)
  ctx.lineTo(x + 5, y + 4)      // base
  ctx.stroke()
}
