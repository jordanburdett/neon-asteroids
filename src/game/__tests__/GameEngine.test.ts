import { describe, it, expect, beforeEach } from 'vitest'
import { GameEngine } from '../GameEngine'
import { GameStatus, AsteroidSize, ASTEROID_RADIUS } from '../types'
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

describe('GameEngine', () => {
  let engine: GameEngine

  beforeEach(() => {
    engine = new GameEngine()
    // Reset to clean PLAYING state with no asteroids or UFO
    engine._injectState({
      status: GameStatus.PLAYING,
      asteroids: [],
      bullets: [],
      ufo: null,
      score: 0,
      lives: 3,
      wave: 1,
      events: [],
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
      },
    })
  })

  // Test 1: Thrust adds velocity in ship facing direction
  it('thrust adds velocity in ship facing direction', () => {
    // Ship faces right (angle=0), thrust for 0.1 seconds
    engine.thrust(true)
    engine.tick(100)  // 100ms = 0.1s

    const state = engine.getState()
    // vx should increase (thrust = 200 px/s², so after 0.1s: 200 * 0.1 = 20 px/s)
    expect(state.ship.vel.x).toBeCloseTo(20, 0)
    expect(state.ship.vel.y).toBeCloseTo(0, 1)
  })

  // Test 2: No deceleration — velocity unchanged without thrust
  it('no deceleration: tick without thrust leaves velocity unchanged', () => {
    engine._injectState({
      ship: {
        pos: { x: 400, y: 300 },
        vel: { x: 50, y: -30 },
        angle: 0,
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
      },
    })
    engine.tick(100)
    const state = engine.getState()
    expect(state.ship.vel.x).toBeCloseTo(50)
    expect(state.ship.vel.y).toBeCloseTo(-30)
  })

  // Test 3: Screen-wrap — ship at x > canvas width wraps around
  it('screen-wrap: ship at x=802 wraps to x=2', () => {
    engine._injectState({
      ship: {
        pos: { x: 802, y: 300 },
        vel: { x: 0, y: 0 },
        angle: 0,
        thrusting: false,
        dying: false,
        respawning: false,
        invulnerableTimer: 0,
        dyingTimer: 0,
        respawnTimer: 0,
        blinkOn: true,
      },
    })
    engine.tick(1)  // 1ms — tiny tick just to trigger position update
    const state = engine.getState()
    expect(state.ship.pos.x).toBeCloseTo(2, 0)
  })

  // Test 4: Bullet travels at correct speed
  it('bullet travels at correct speed', () => {
    // Ship at center facing right
    engine.fire()
    const stateAfterFire = engine.getState()
    const bulletBefore = stateAfterFire.bullets.find(b => !b.fromUfo)
    expect(bulletBefore).toBeDefined()
    const startX = bulletBefore!.pos.x

    const DT = 50  // ms
    engine.tick(DT)
    const stateAfterTick = engine.getState()
    const bulletAfter = stateAfterTick.bullets.find(b => !b.fromUfo)
    expect(bulletAfter).toBeDefined()

    // Expected distance = 500 * (DT/1000)
    const expectedDist = 500 * (DT / 1000)
    const actualDist = bulletAfter!.pos.x - startX
    expect(actualDist).toBeCloseTo(expectedDist, 0)
  })

  // Test 5: Bullet expires after 1.2 seconds
  it('bullet expires after 1.2 seconds', () => {
    // Place an asteroid far from ship to keep game in PLAYING state
    // (without asteroids, the tick sets WAVE_CLEAR and bullets don't get ticked)
    const farAst = makeAsteroid(AsteroidSize.LARGE, { x: 700, y: 500 }, 77)
    engine._injectState({ asteroids: [farAst] })

    engine.fire()
    expect(engine.getState().bullets.filter(b => !b.fromUfo).length).toBe(1)

    // Tick for 1.19 seconds — bullet should still be alive
    engine.tick(1190)
    expect(engine.getState().bullets.filter(b => !b.fromUfo).length).toBe(1)

    // Tick the rest past the 1.2s mark
    engine.tick(20)
    expect(engine.getState().bullets.filter(b => !b.fromUfo).length).toBe(0)
  })

  // Test 6: LARGE asteroid hit creates exactly 2 MEDIUM fragments + event queued
  it('LARGE asteroid hit creates 2 MEDIUM fragments and queues ASTEROID_HIT event', () => {
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 400, y: 300 })
    engine._injectState({ asteroids: [ast] })

    // Place bullet exactly on asteroid center
    const state = engine.getState()
    state.bullets.push({
      pos: { x: 400, y: 300 },
      vel: { x: 500, y: 0 },
      lifetime: 1.2,
      fromUfo: false,
    })
    engine._injectState({ bullets: state.bullets })

    engine.tick(1)

    const after = engine.getState()
    // Should have exactly 2 MEDIUM children
    expect(after.asteroids.length).toBe(2)
    expect(after.asteroids.every(a => a.size === AsteroidSize.MEDIUM)).toBe(true)

    const events = engine.drainEvents()
    const hitEvent = events.find(e => e.type === 'ASTEROID_HIT')
    expect(hitEvent).toBeDefined()
    expect(hitEvent).toMatchObject({ type: 'ASTEROID_HIT', size: AsteroidSize.LARGE })
  })

  // Test 7: MEDIUM asteroid hit creates 2 SMALL fragments
  it('MEDIUM asteroid hit creates 2 SMALL fragments', () => {
    const ast = makeAsteroid(AsteroidSize.MEDIUM, { x: 400, y: 300 })
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

    const after = engine.getState()
    expect(after.asteroids.length).toBe(2)
    expect(after.asteroids.every(a => a.size === AsteroidSize.SMALL)).toBe(true)
  })

  // Test 8: SMALL asteroid hit destroys it with no fragments
  it('SMALL asteroid hit destroys it with no fragments and queues ASTEROID_HIT', () => {
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

    const after = engine.getState()
    expect(after.asteroids.length).toBe(0)

    const events = engine.drainEvents()
    const hitEvent = events.find(e => e.type === 'ASTEROID_HIT')
    expect(hitEvent).toBeDefined()
  })

  // Test 9: Ship vertex within asteroid radius → SHIP_DYING
  it('ship vertex within asteroid radius triggers SHIP_DYING', () => {
    // Place asteroid right at ship's nose position
    // Ship at (400,300) facing right (angle=0), nose = (422, 300)
    const ast = makeAsteroid(AsteroidSize.LARGE, { x: 422, y: 300 })
    engine._injectState({ asteroids: [ast] })

    engine.tick(1)

    expect(engine.getState().status).toBe(GameStatus.SHIP_DYING)
  })

  // Test 10: All asteroids cleared → WAVE_CLEAR
  it('all asteroids cleared triggers WAVE_CLEAR status', () => {
    // Single SMALL asteroid, bullet on top of it
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

    expect(engine.getState().status).toBe(GameStatus.WAVE_CLEAR)
  })
})

