import { describe, it, expect, beforeEach } from 'vitest'
import { GameEngine } from '../GameEngine'
import { GameStatus, AsteroidSize, ASTEROID_RADIUS, PhaseShiftStatus } from '../types'
import type { Asteroid, Vec2 } from '../types'

// Helper: build a minimal asteroid at given position/size
function makeAsteroid(size: AsteroidSize, pos: Vec2, id = 99): Asteroid {
  return {
    id,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    size,
    radius: ASTEROID_RADIUS[size],
    angle: 0,
    angularVel: 0,
    vertices: [
      { x: ASTEROID_RADIUS[size], y: 0 },
      { x: 0, y: ASTEROID_RADIUS[size] },
      { x: -ASTEROID_RADIUS[size], y: 0 },
      { x: 0, y: -ASTEROID_RADIUS[size] },
    ],
  }
}

describe('Polish tests (na-003)', () => {
  let engine: GameEngine

  beforeEach(() => {
    engine = new GameEngine()
    engine._injectState({
      status: GameStatus.PLAYING,
      asteroids: [],
      bullets: [],
      ufo: null,
      score: 0,
      lives: 3,
      wave: 1,
      events: [],
      particles: [],
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 0, y: 0 },
        angle: 0,          // facing right (east)
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
        phasing: false,
      },
    })
  })

  // Test 1: drainEvents() returns FIRE event after engine.fire()
  it('drainEvents() returns FIRE event after engine.fire()', () => {
    engine.fire()
    const events = engine.drainEvents()
    expect(events.some(e => e.type === 'FIRE')).toBe(true)
  })

  // Test 2: drainEvents() returns ASTEROID_HIT with correct size field when bullet hits asteroid
  it('drainEvents() returns ASTEROID_HIT with correct size when bullet hits asteroid', () => {
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 400, y: 300 })
    engine._injectState({ asteroids: [ast] })

    const state = engine.getState()
    state.bullets.push({
      pos: { x: 400, y: 300 },
      vel: { x: 500, y: 0 },
      lifetime: 1.2,
      fromUfo: false,
    })
    engine._injectState({ bullets: state.bullets })
    engine.tick(1)

    const events = engine.drainEvents()
    const hitEvt = events.find(e => e.type === 'ASTEROID_HIT')
    expect(hitEvt).toBeDefined()
    expect(hitEvt).toMatchObject({ type: 'ASTEROID_HIT', size: AsteroidSize.LARGE })
  })

  // Test 3: drainEvents() returns SHIP_DIE when ship collides with asteroid
  it('drainEvents() returns SHIP_DIE when ship collides with asteroid', () => {
    // Ship at (400,300) facing right, nose at (422,300)
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 422, y: 300 })
    engine._injectState({ asteroids: [ast] })
    engine.tick(1)

    const events = engine.drainEvents()
    expect(events.some(e => e.type === 'SHIP_DIE')).toBe(true)
  })

  // Test 4: drainEvents() returns WAVE_CLEAR when all asteroids destroyed
  it('drainEvents() returns WAVE_CLEAR when all asteroids destroyed', () => {
    const ast = makeAsteroid(AsteroidSize.SMALL, { x: 400, y: 300 })
    engine._injectState({ asteroids: [ast] })

    const state = engine.getState()
    state.bullets.push({
      pos: { x: 400, y: 300 },
      vel: { x: 500, y: 0 },
      lifetime: 1.2,
      fromUfo: false,
    })
    engine._injectState({ bullets: state.bullets })
    engine.tick(1)

    const events = engine.drainEvents()
    expect(events.some(e => e.type === 'WAVE_CLEAR')).toBe(true)
  })

  // Test 5: drainEvents() returns PHASE_SHIFT_ACTIVATE when activatePhaseShift() called
  it('drainEvents() returns PHASE_SHIFT_ACTIVATE when activatePhaseShift() called', () => {
    engine.activatePhaseShift()
    const events = engine.drainEvents()
    expect(events.some(e => e.type === 'PHASE_SHIFT_ACTIVATE')).toBe(true)
  })

  // Test 6: drainEvents() clears after first drain (second call returns [])
  it('drainEvents() clears events — second call returns []', () => {
    engine.fire()
    engine.drainEvents()  // first drain — clears
    const second = engine.drainEvents()
    expect(second).toHaveLength(0)
  })

  // Test 7: Particles — asteroid split (bullet hits LARGE) spawns ASTEROID_RING particle
  it('bullet hitting LARGE asteroid spawns an ASTEROID_RING particle', () => {
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 400, y: 300 })
    engine._injectState({ asteroids: [ast] })

    const state = engine.getState()
    state.bullets.push({
      pos: { x: 400, y: 300 },
      vel: { x: 500, y: 0 },
      lifetime: 1.2,
      fromUfo: false,
    })
    engine._injectState({ bullets: state.bullets })
    engine.tick(1)

    const particles = engine.getState().particles
    const ringParticle = particles.find(p => p.type === 'ASTEROID_RING')
    expect(ringParticle).toBeDefined()
  })

  // Test 8: Particles — ship die spawns exactly 6 SHIP_DEATH_LINE particles
  it('ship death spawns exactly 6 SHIP_DEATH_LINE particles', () => {
    // Place asteroid at ship nose to trigger death
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 422, y: 300 })
    engine._injectState({ asteroids: [ast] })
    engine.tick(1)

    const particles = engine.getState().particles
    const deathLines = particles.filter(p => p.type === 'SHIP_DEATH_LINE')
    expect(deathLines).toHaveLength(6)
  })

  // Test 9: Particles — activatePhaseShift resolves into PHASE_RING particle
  it('phase shift resolves and spawns PHASE_RING particle', () => {
    // Keep a far-away asteroid so the game stays in PLAYING state while phasing resolves
    const farAst = makeAsteroid(AsteroidSize.LARGE, { x: 700, y: 500 }, 77)
    engine._injectState({ asteroids: [farAst] })

    engine.activatePhaseShift()
    // Tick in small increments to let phasing resolve without expiring the ring particle
    // PHASING duration = 1.5s, PHASE_RING duration = 600ms
    // Tick 1550ms total in 100ms steps + final 50ms
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(100)
    engine.tick(50)  // total = 1550ms > 1500ms — phasing resolves, then ~50ms of particle life

    const particles = engine.getState().particles
    const phaseRing = particles.find(p => p.type === 'PHASE_RING')
    expect(phaseRing).toBeDefined()
    expect(engine.getState().phaseShiftStatus).toBe(PhaseShiftStatus.COOLDOWN)
  })

  // Test 10: Pause — togglePause sets PAUSED, tick doesn't advance ship position
  it('togglePause sets PAUSED and tick does not advance ship position', () => {
    // Give ship a velocity so we can detect if it moved
    engine._injectState({
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 100, y: 0 },
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
    })

    engine.togglePause()
    expect(engine.getState().status).toBe(GameStatus.PAUSED)

    const posBefore = { ...engine.getState().ship.pos }
    engine.tick(16)
    const posAfter = engine.getState().ship.pos

    expect(posAfter.x).toBe(posBefore.x)
    expect(posAfter.y).toBe(posBefore.y)
  })
})
