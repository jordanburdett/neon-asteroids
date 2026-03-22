import { describe, it, expect, vi } from 'vitest'
import {
  generateDailyWave,
  getDayNumber,
  buildShareText,
  type DailyRecord,
} from '../DailyChallenge'
import { GameEngine } from '../GameEngine'
import { GameStatus, PhaseShiftStatus } from '../types'
import type { Asteroid } from '../types'

// Helper: build a minimal asteroid at given position
function makeAsteroid(id: number, x: number, y: number, radius = 55): Asteroid {
  return {
    id,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    size: 'LARGE',
    radius,
    angle: 0,
    angularVel: 0,
    vertices: [
      { x: radius, y: 0 },
      { x: 0, y: radius },
      { x: -radius, y: 0 },
      { x: 0, y: -radius },
    ],
  }
}

describe('DailyChallenge', () => {
  // Test 1: Same dailySeed + waveIndex 0 → identical asteroid count = 4
  it('same dailySeed + waveIndex 0 → 4 asteroids (min(4+0, 8))', () => {
    const seed = 20260322
    const wave1 = generateDailyWave(seed, 0)
    const wave2 = generateDailyWave(seed, 0)
    expect(wave1.asteroids.length).toBe(4)
    expect(wave2.asteroids.length).toBe(4)
  })

  // Test 2: Same dailySeed + waveIndex 0 → identical first asteroid position
  it('same dailySeed + waveIndex 0 → identical first asteroid position', () => {
    const seed = 20260322
    const wave1 = generateDailyWave(seed, 0)
    const wave2 = generateDailyWave(seed, 0)
    expect(wave1.asteroids[0].x).toBeCloseTo(wave2.asteroids[0].x, 5)
    expect(wave1.asteroids[0].y).toBeCloseTo(wave2.asteroids[0].y, 5)
  })

  // Test 3: Different dailySeed → different first asteroid position
  it('different dailySeed → different first asteroid position', () => {
    const wave1 = generateDailyWave(20260322, 0)
    const wave2 = generateDailyWave(20260323, 0)
    const sameX = Math.abs(wave1.asteroids[0].x - wave2.asteroids[0].x) < 0.001
    const sameY = Math.abs(wave1.asteroids[0].y - wave2.asteroids[0].y) < 0.001
    expect(sameX && sameY).toBe(false)
  })

  // Test 4: waveIndex 4 → 8 asteroids (capped at max 8)
  it('waveIndex 4 → 8 asteroids (capped)', () => {
    const wave = generateDailyWave(20260322, 4)
    expect(wave.asteroids.length).toBe(8)
  })

  // Test 5: Phase Shift starts READY on new GameEngine
  it('phase shift starts READY on new GameEngine', () => {
    const engine = new GameEngine()
    expect(engine.getState().phaseShiftStatus).toBe(PhaseShiftStatus.READY)
  })

  // Test 6: activatePhaseShift() → phaseShiftStatus becomes PHASING
  it('activatePhaseShift() sets phaseShiftStatus to PHASING', () => {
    const engine = new GameEngine()
    engine._injectState({
      status: GameStatus.PLAYING,
      asteroids: [],
      bullets: [],
      ufo: null,
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 0, y: 0 },
        angle: 0,
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
        phasing: false,
      },
      phaseShiftStatus: PhaseShiftStatus.READY,
    })
    engine.activatePhaseShift()
    expect(engine.getState().phaseShiftStatus).toBe(PhaseShiftStatus.PHASING)
  })

  // Test 7: During PHASING, ship.phasing flag is true (collision disabled)
  it('during PHASING, ship.phasing is true', () => {
    const engine = new GameEngine()
    // Keep a far-away asteroid so the wave doesn't immediately clear
    const farAsteroid = makeAsteroid(99, 700, 500)
    engine._injectState({
      status: GameStatus.PLAYING,
      asteroids: [farAsteroid],
      bullets: [],
      ufo: null,
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 0, y: 0 },
        angle: 0,
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
        phasing: false,
      },
      phaseShiftStatus: PhaseShiftStatus.READY,
    })
    engine.activatePhaseShift()
    expect(engine.getState().ship.phasing).toBe(true)

    // Tick 0.5s — still in PHASING window (1.5s total)
    engine.tick(500)
    expect(engine.getState().ship.phasing).toBe(true)
    expect(engine.getState().status).toBe(GameStatus.PLAYING)
  })

  // Test 8: After PHASING resolves, ship is >= 120px from all asteroids
  it('after PHASING resolves, ship is >= 120px from all asteroids', () => {
    const engine = new GameEngine()
    // Place asteroids in the corners — ship should find a safe spot
    const cornerAsteroids: Asteroid[] = [
      makeAsteroid(1, 50, 50),
      makeAsteroid(2, 750, 50),
      makeAsteroid(3, 50, 550),
      makeAsteroid(4, 750, 550),
    ]
    engine._injectState({
      status: GameStatus.PLAYING,
      asteroids: cornerAsteroids,
      bullets: [],
      ufo: null,
      score: 0,
      lives: 3,
      wave: 1,
      events: [],
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 0, y: 0 },
        angle: 0,
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
        phasing: false,
      },
      phaseShiftStatus: PhaseShiftStatus.READY,
    })
    engine.activatePhaseShift()

    // Tick past the 1.5s phasing window
    engine.tick(1600)

    const state = engine.getState()
    expect(state.phaseShiftStatus).toBe(PhaseShiftStatus.COOLDOWN)
    expect(state.ship.phasing).toBe(false)

    const shipPos = state.ship.pos
    for (const ast of state.asteroids) {
      const dx = shipPos.x - ast.pos.x
      const dy = shipPos.y - ast.pos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      expect(d).toBeGreaterThanOrEqual(120)
    }
  })

  // Test 9: getDayNumber() returns 0 for 2026-01-01
  it('getDayNumber() returns 0 for 2026-01-01', () => {
    // Mock Date to 2026-01-01
    const RealDate = Date
    const mockDate = new RealDate(2026, 0, 1, 12, 0, 0)
    vi.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return mockDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new RealDate(...(args as [any]))
    })
    // Make new Date() with no args return our mock
    vi.spyOn(globalThis, 'Date').mockImplementation(function(this: unknown, ...args: unknown[]) {
      if (args.length === 0) return mockDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new RealDate(...(args as [any]))
    } as unknown as typeof Date)

    const n = getDayNumber()
    vi.restoreAllMocks()
    expect(n).toBe(0)
  })

  // Test 10: buildShareText with 3 clean waves
  it('buildShareText() formats 3 clean waves correctly', () => {
    const record: DailyRecord = {
      completed: true,
      waveEmojis: ['🌑', '🌑', '🌑'],
      score: 1500,
      dayNumber: 7,
      wavesCleared: 3,
    }
    const text = buildShareText(record)
    expect(text).toBe('Neon Asteroids Daily #7\n🌑🌑🌑\nWave 3 — Score: 1500\nactuallyfun.games')
  })
})

describe('DailyChallenge asteroid specs', () => {
  it('asteroid positions are within canvas bounds', () => {
    const wave = generateDailyWave(20260322, 0)
    for (const ast of wave.asteroids) {
      expect(ast.x).toBeGreaterThanOrEqual(50)
      expect(ast.x).toBeLessThanOrEqual(750)
      expect(ast.y).toBeGreaterThanOrEqual(50)
      expect(ast.y).toBeLessThanOrEqual(550)
    }
  })

  it('asteroid velocities are in 40-100 px/s range', () => {
    const wave = generateDailyWave(20260322, 0)
    for (const ast of wave.asteroids) {
      const speed = Math.sqrt(ast.vx * ast.vx + ast.vy * ast.vy)
      expect(speed).toBeGreaterThanOrEqual(39)  // small float tolerance
      expect(speed).toBeLessThanOrEqual(101)
    }
  })
})

