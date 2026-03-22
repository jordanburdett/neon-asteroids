import {
  GameStatus,
  AsteroidSize,
  ASTEROID_RADIUS,
  ASTEROID_SCORE,
  type GameState,
  type GameEvent,
  type Asteroid,
  type Ufo,
  type Vec2,
} from './types'
import {
  dist,
  add,
  scale,
  wrapPosition,
  randomBetween,
  randomSign,
  length,
} from '../utils/math'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const SHIP_ROTATION_SPEED = Math.PI  // rad/s (180 deg/s)
const SHIP_THRUST = 200              // px/s²
const BULLET_SPEED = 500             // px/s
const BULLET_LIFETIME = 1.2          // seconds
const MAX_BULLETS = 4
const SHIP_DYING_DURATION = 0.5
const SHIP_RESPAWN_DURATION = 2.0
const SHIP_BLINK_FREQ = 4            // Hz
const WAVE_CLEAR_PAUSE = 1.5         // seconds
const INITIAL_LIVES = 3
const WAVE_1_ASTEROIDS = 4
const MAX_WAVE_ASTEROIDS = 8
const MIN_SPAWN_DIST_FROM_SHIP = 150 // px
const UFO_SCORE_THRESHOLD = 10000
const UFO_SPEED = 90                 // px/s
const UFO_FIRE_INTERVAL = 2.5        // seconds
const UFO_BULLET_SPEED = 400         // px/s
const MAX_UFO_BULLETS = 2
const UFO_REENTRY_MIN = 3            // seconds
const UFO_REENTRY_MAX = 8            // seconds
const UFO_SCORE = 1000

let _asteroidIdCounter = 0

function nextAsteroidId(): number {
  return ++_asteroidIdCounter
}

function buildAsteroidVertices(radius: number): Vec2[] {
  const count = 8 + Math.floor(Math.random() * 5)  // 8-12 vertices
  const verts: Vec2[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const jitter = randomBetween(-0.2, 0.2) * radius
    const r = radius + jitter
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }
  return verts
}

function spawnAsteroid(
  size: AsteroidSize,
  pos: Vec2,
  vel: Vec2,
  idCounter: number
): Asteroid {
  const radius = ASTEROID_RADIUS[size]
  return {
    id: idCounter,
    pos: { ...pos },
    vel: { ...vel },
    size,
    radius,
    angle: 0,
    angularVel: randomBetween(0.5, 2.5) * randomSign(),
    vertices: buildAsteroidVertices(radius),
  }
}

function spawnAsteroidAtRandom(size: AsteroidSize, shipPos: Vec2): Asteroid {
  let pos: Vec2
  do {
    pos = {
      x: randomBetween(0, CANVAS_WIDTH),
      y: randomBetween(0, CANVAS_HEIGHT),
    }
  } while (dist(pos, shipPos) < MIN_SPAWN_DIST_FROM_SHIP)

  const angle = randomBetween(0, Math.PI * 2)
  const speed = randomBetween(40, 120)
  const vel: Vec2 = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }

  return spawnAsteroid(size, pos, vel, nextAsteroidId())
}

function splitAsteroid(
  parent: Asteroid,
  events: GameEvent[]
): Asteroid[] {
  events.push({ type: 'ASTEROID_HIT', size: parent.size })

  if (parent.size === AsteroidSize.SMALL) {
    return []
  }

  const childSize =
    parent.size === AsteroidSize.LARGE ? AsteroidSize.MEDIUM : AsteroidSize.SMALL

  const parentSpeed = length(parent.vel)
  const childSpeed = parentSpeed * 1.3
  const parentAngle = Math.atan2(parent.vel.y, parent.vel.x)

  const children: Asteroid[] = []
  for (const offset of [-Math.PI / 4, Math.PI / 4]) {
    const angle = parentAngle + offset
    const vel: Vec2 = {
      x: Math.cos(angle) * childSpeed,
      y: Math.sin(angle) * childSpeed,
    }
    children.push(spawnAsteroid(childSize, parent.pos, vel, nextAsteroidId()))
  }
  return children
}

function shipFacingVector(angle: number): Vec2 {
  // angle 0 = pointing right (east), positive = clockwise
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function getShipVertices(state: GameState): Vec2[] {
  const { ship } = state
  const facing = shipFacingVector(ship.angle)
  const perp: Vec2 = { x: -facing.y, y: facing.x }

  const nose = add(ship.pos, scale(facing, 22))
  const leftFin = add(add(ship.pos, scale(facing, -12)), scale(perp, 10))
  const rightFin = add(add(ship.pos, scale(facing, -12)), scale(perp, -10))
  return [nose, leftFin, rightFin]
}

function createInitialShip(): GameState['ship'] {
  return {
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2, // pointing up
    thrusting: false,
    dying: false,
    respawning: false,
    invulnerableTimer: 0,
    dyingTimer: 0,
    respawnTimer: 0,
    blinkOn: true,
  }
}

function createInitialState(): GameState {
  const ship = createInitialShip()
  const asteroids: Asteroid[] = []
  const count = WAVE_1_ASTEROIDS
  for (let i = 0; i < count; i++) {
    asteroids.push(spawnAsteroidAtRandom(AsteroidSize.LARGE, ship.pos))
  }
  const highScore = loadHighScore()
  return {
    status: GameStatus.PLAYING,
    ship,
    bullets: [],
    asteroids,
    ufo: null,
    score: 0,
    highScore,
    lives: INITIAL_LIVES,
    wave: 1,
    waveTimer: 0,
    events: [],
    asteroidIdCounter: _asteroidIdCounter,
  }
}

function loadHighScore(): number {
  try {
    return parseInt(localStorage.getItem('na_highscore') ?? '0', 10) || 0
  } catch {
    return 0
  }
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem('na_highscore', String(score))
  } catch {
    // ignore
  }
}

export class GameEngine {
  private state: GameState
  private rotLeft = false
  private rotRight = false
  private thrustDown = false
  private fireCooldown = 0  // seconds

  constructor() {
    this.state = createInitialState()
  }

  getState(): GameState {
    return this.state
  }

  rotateLeft(down: boolean): void {
    this.rotLeft = down
  }

  rotateRight(down: boolean): void {
    this.rotRight = down
  }

  thrust(down: boolean): void {
    this.thrustDown = down
    this.state.ship.thrusting = down
  }

  fire(): void {
    const { state } = this
    if (
      state.status !== GameStatus.PLAYING ||
      state.ship.dying ||
      state.ship.respawning
    ) return

    const playerBullets = state.bullets.filter(b => !b.fromUfo)
    if (playerBullets.length >= MAX_BULLETS) return

    const facing = shipFacingVector(state.ship.angle)
    const bulletVel = scale(facing, BULLET_SPEED)
    // Start bullet at nose of ship
    const nose = add(state.ship.pos, scale(facing, 22))
    state.bullets.push({
      pos: { ...nose },
      vel: bulletVel,
      lifetime: BULLET_LIFETIME,
      fromUfo: false,
    })
    state.events.push({ type: 'FIRE' })
  }

  togglePause(): void {
    if (this.state.status === GameStatus.PLAYING) {
      this.state.status = GameStatus.PAUSED
    } else if (this.state.status === GameStatus.PAUSED) {
      this.state.status = GameStatus.PLAYING
    }
  }

  drainEvents(): GameEvent[] {
    const events = this.state.events.slice()
    this.state.events = []
    return events
  }

  tick(deltaMs: number): void {
    const dt = deltaMs / 1000  // convert to seconds
    const { state } = this

    if (
      state.status === GameStatus.PAUSED ||
      state.status === GameStatus.GAME_OVER ||
      state.status === GameStatus.MENU
    ) {
      return
    }

    if (state.status === GameStatus.WAVE_CLEAR) {
      state.waveTimer -= dt
      if (state.waveTimer <= 0) {
        this.startNextWave()
      }
      return
    }

    if (state.status === GameStatus.SHIP_DYING) {
      state.ship.dyingTimer -= dt
      if (state.ship.dyingTimer <= 0) {
        state.ship.dying = false
        if (state.lives <= 0) {
          state.status = GameStatus.GAME_OVER
          state.events.push({ type: 'GAME_OVER' })
          if (state.score > state.highScore) {
            state.highScore = state.score
            saveHighScore(state.score)
          }
          return
        }
        // Begin respawn
        state.ship = createInitialShip()
        state.ship.respawning = true
        state.ship.invulnerableTimer = SHIP_RESPAWN_DURATION
        state.ship.respawnTimer = SHIP_RESPAWN_DURATION
        state.status = GameStatus.RESPAWNING
      }
      return
    }

    if (state.status === GameStatus.RESPAWNING) {
      state.ship.invulnerableTimer -= dt
      state.ship.respawnTimer -= dt
      // Blink at 4Hz
      const blinkPhase = Math.floor(state.ship.invulnerableTimer * SHIP_BLINK_FREQ)
      state.ship.blinkOn = (blinkPhase % 2 === 0)

      if (state.ship.invulnerableTimer <= 0) {
        state.ship.respawning = false
        state.ship.blinkOn = true
        state.status = GameStatus.PLAYING
      }
    }

    this.tickPlaying(dt)
  }

  private tickPlaying(dt: number): void {
    const { state } = this

    // Rotation
    if (this.rotLeft) {
      state.ship.angle -= SHIP_ROTATION_SPEED * dt
    }
    if (this.rotRight) {
      state.ship.angle += SHIP_ROTATION_SPEED * dt
    }

    // Thrust (no drag — velocity only increases)
    if (this.thrustDown && !state.ship.dying && !state.ship.dying) {
      const facing = shipFacingVector(state.ship.angle)
      state.ship.vel.x += facing.x * SHIP_THRUST * dt
      state.ship.vel.y += facing.y * SHIP_THRUST * dt
    }

    // Move ship
    if (!state.ship.dying) {
      state.ship.pos.x += state.ship.vel.x * dt
      state.ship.pos.y += state.ship.vel.y * dt
      state.ship.pos = wrapPosition(state.ship.pos, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    // Fire cooldown
    if (this.fireCooldown > 0) this.fireCooldown -= dt

    // Move bullets
    state.bullets = state.bullets.filter(b => {
      b.lifetime -= dt
      if (b.lifetime <= 0) return false
      b.pos.x += b.vel.x * dt
      b.pos.y += b.vel.y * dt
      b.pos = wrapPosition(b.pos, CANVAS_WIDTH, CANVAS_HEIGHT)
      return true
    })

    // Move asteroids
    for (const ast of state.asteroids) {
      ast.pos.x += ast.vel.x * dt
      ast.pos.y += ast.vel.y * dt
      ast.pos = wrapPosition(ast.pos, CANVAS_WIDTH, CANVAS_HEIGHT)
      ast.angle += ast.angularVel * dt
    }

    // Tick UFO
    this.tickUfo(dt)

    // Bullet vs asteroid collision
    this.checkBulletAsteroidCollisions()

    // Ship vs asteroid collision (only when not invulnerable / dying)
    if (
      state.status === GameStatus.PLAYING &&
      !state.ship.dying &&
      !state.ship.respawning &&
      state.ship.invulnerableTimer <= 0
    ) {
      this.checkShipAsteroidCollisions()
    }

    // Bullet vs UFO collision
    this.checkBulletUfoCollisions()

    // Check wave clear
    if (
      state.status === GameStatus.PLAYING &&
      state.asteroids.length === 0 &&
      state.ufo === null
    ) {
      state.status = GameStatus.WAVE_CLEAR
      state.waveTimer = WAVE_CLEAR_PAUSE
      state.events.push({ type: 'WAVE_CLEAR' })
    }

    // Check UFO spawn threshold
    if (
      state.score >= UFO_SCORE_THRESHOLD &&
      state.ufo === null &&
      state.status === GameStatus.PLAYING
    ) {
      this.spawnUfo()
    }
  }

  private tickUfo(dt: number): void {
    const { state } = this
    const ufo = state.ufo
    if (ufo === null) return

    if (!ufo.active) {
      ufo.exitTimer -= dt
      if (ufo.exitTimer <= 0) {
        // Re-enter from left or right
        const fromLeft = Math.random() < 0.5
        ufo.pos = {
          x: fromLeft ? 0 : CANVAS_WIDTH,
          y: randomBetween(50, CANVAS_HEIGHT - 50),
        }
        ufo.vel = { x: fromLeft ? UFO_SPEED : -UFO_SPEED, y: 0 }
        ufo.active = true
        ufo.fireTimer = UFO_FIRE_INTERVAL
        state.events.push({ type: 'UFO_START' })
      }
      return
    }

    // Move UFO
    ufo.pos.x += ufo.vel.x * dt

    // Check if UFO has exited the screen
    if (ufo.pos.x < -50 || ufo.pos.x > CANVAS_WIDTH + 50) {
      ufo.active = false
      ufo.exitTimer = randomBetween(UFO_REENTRY_MIN, UFO_REENTRY_MAX)
      state.events.push({ type: 'UFO_STOP' })
      return
    }

    // UFO fire
    ufo.fireTimer -= dt
    if (ufo.fireTimer <= 0) {
      ufo.fireTimer = UFO_FIRE_INTERVAL
      this.ufoFire()
    }
  }

  private ufoFire(): void {
    const { state } = this
    const ufo = state.ufo
    if (ufo === null || !ufo.active) return

    const ufoBullets = state.bullets.filter(b => b.fromUfo)
    if (ufoBullets.length >= MAX_UFO_BULLETS) return

    // Aim at ship
    const dx = state.ship.pos.x - ufo.pos.x
    const dy = state.ship.pos.y - ufo.pos.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return

    const vel: Vec2 = {
      x: (dx / len) * UFO_BULLET_SPEED,
      y: (dy / len) * UFO_BULLET_SPEED,
    }

    state.bullets.push({
      pos: { ...ufo.pos },
      vel,
      lifetime: BULLET_LIFETIME,
      fromUfo: true,
    })
  }

  private spawnUfo(): void {
    const fromLeft = Math.random() < 0.5
    const ufo: Ufo = {
      pos: {
        x: fromLeft ? 0 : CANVAS_WIDTH,
        y: randomBetween(50, this.state.status === GameStatus.PLAYING ? CANVAS_HEIGHT - 50 : 300),
      },
      vel: { x: fromLeft ? UFO_SPEED : -UFO_SPEED, y: 0 },
      active: true,
      fireTimer: UFO_FIRE_INTERVAL,
      exitTimer: 0,
    }
    this.state.ufo = ufo
    this.state.events.push({ type: 'UFO_START' })
  }

  private checkBulletAsteroidCollisions(): void {
    const { state } = this
    const newAsteroids: Asteroid[] = []
    const hitAsteroidIds = new Set<number>()
    const hitBulletIndices = new Set<number>()

    for (let bi = 0; bi < state.bullets.length; bi++) {
      const bullet = state.bullets[bi]
      if (bullet.fromUfo) continue  // UFO bullets don't hit asteroids

      for (const ast of state.asteroids) {
        if (hitAsteroidIds.has(ast.id)) continue
        const d = dist(bullet.pos, ast.pos)
        if (d < ast.radius + 3) {
          hitAsteroidIds.add(ast.id)
          hitBulletIndices.add(bi)

          // Add score
          state.score += ASTEROID_SCORE[ast.size]
          if (state.score > state.highScore) {
            state.highScore = state.score
            saveHighScore(state.score)
          }

          // Split
          const fragments = splitAsteroid(ast, state.events)
          newAsteroids.push(...fragments)
          break
        }
      }
    }

    state.bullets = state.bullets.filter((_, i) => !hitBulletIndices.has(i))
    state.asteroids = state.asteroids
      .filter(a => !hitAsteroidIds.has(a.id))
      .concat(newAsteroids)
  }

  private checkShipAsteroidCollisions(): void {
    const { state } = this
    const shipVerts = getShipVertices(state)

    for (const ast of state.asteroids) {
      for (const vert of shipVerts) {
        if (dist(vert, ast.pos) < ast.radius) {
          this.killShip()
          return
        }
      }
    }
  }

  private checkBulletUfoCollisions(): void {
    const { state } = this
    const ufo = state.ufo
    if (ufo === null || !ufo.active) return

    const UFO_COLLISION_RADIUS = 20
    const hitBulletIndices = new Set<number>()

    for (let bi = 0; bi < state.bullets.length; bi++) {
      const bullet = state.bullets[bi]
      if (bullet.fromUfo) continue
      if (dist(bullet.pos, ufo.pos) < UFO_COLLISION_RADIUS) {
        hitBulletIndices.add(bi)
        state.score += UFO_SCORE
        if (state.score > state.highScore) {
          state.highScore = state.score
          saveHighScore(state.score)
        }
        state.ufo = null
        state.events.push({ type: 'UFO_HIT' })
        state.events.push({ type: 'UFO_STOP' })
        break
      }
    }

    state.bullets = state.bullets.filter((_, i) => !hitBulletIndices.has(i))
  }

  private killShip(): void {
    const { state } = this
    state.lives -= 1
    state.ship.dying = true
    state.ship.thrusting = false
    state.ship.dyingTimer = SHIP_DYING_DURATION
    state.status = GameStatus.SHIP_DYING
    state.events.push({ type: 'SHIP_DIE' })
    this.thrustDown = false
  }

  private startNextWave(): void {
    const { state } = this
    state.wave += 1
    const asteroidCount = Math.min(WAVE_1_ASTEROIDS + (state.wave - 1), MAX_WAVE_ASTEROIDS)
    const asteroids: Asteroid[] = []
    for (let i = 0; i < asteroidCount; i++) {
      asteroids.push(spawnAsteroidAtRandom(AsteroidSize.LARGE, state.ship.pos))
    }
    state.asteroids = asteroids
    state.ufo = null
    state.status = GameStatus.PLAYING
  }

  // For testing: allow injecting state
  _injectState(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial }
  }

  _getShipVertices(): Vec2[] {
    return getShipVertices(this.state)
  }
}

// Named export for canvas dimensions used by renderer
export const GAME_WIDTH = CANVAS_WIDTH
export const GAME_HEIGHT = CANVAS_HEIGHT

// Named export for ship vertices helper (used by renderer)
export { getShipVertices, shipFacingVector }
