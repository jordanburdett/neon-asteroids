// GameStatus const-object pattern (no enum)
export const GameStatus = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  SHIP_DYING: 'SHIP_DYING',
  RESPAWNING: 'RESPAWNING',
  WAVE_CLEAR: 'WAVE_CLEAR',
  GAME_OVER: 'GAME_OVER',
  PAUSED: 'PAUSED',
} as const
export type GameStatus = typeof GameStatus[keyof typeof GameStatus]

// AsteroidSize const-object pattern (no enum)
export const AsteroidSize = {
  LARGE: 'LARGE',
  MEDIUM: 'MEDIUM',
  SMALL: 'SMALL',
} as const
export type AsteroidSize = typeof AsteroidSize[keyof typeof AsteroidSize]

export const ASTEROID_RADIUS: Record<AsteroidSize, number> = {
  LARGE: 55,
  MEDIUM: 30,
  SMALL: 16,
}

export const ASTEROID_SCORE: Record<AsteroidSize, number> = {
  LARGE: 20,
  MEDIUM: 50,
  SMALL: 100,
}

// GameEvent types
export const GameEventType = {
  FIRE: 'FIRE',
  ASTEROID_HIT: 'ASTEROID_HIT',
  SHIP_DIE: 'SHIP_DIE',
  WAVE_CLEAR: 'WAVE_CLEAR',
  UFO_START: 'UFO_START',
  UFO_STOP: 'UFO_STOP',
  UFO_HIT: 'UFO_HIT',
  GAME_OVER: 'GAME_OVER',
} as const
export type GameEventType = typeof GameEventType[keyof typeof GameEventType]

export type GameEvent =
  | { type: 'FIRE' }
  | { type: 'ASTEROID_HIT'; size: AsteroidSize }
  | { type: 'SHIP_DIE' }
  | { type: 'WAVE_CLEAR' }
  | { type: 'UFO_START' }
  | { type: 'UFO_STOP' }
  | { type: 'UFO_HIT' }
  | { type: 'GAME_OVER' }

export interface Vec2 {
  x: number
  y: number
}

export interface Ship {
  pos: Vec2
  vel: Vec2
  angle: number      // radians, 0 = pointing right, positive = clockwise
  thrusting: boolean
  dying: boolean
  respawning: boolean
  invulnerableTimer: number  // seconds remaining of invulnerability
  dyingTimer: number         // seconds remaining of death animation
  respawnTimer: number       // seconds remaining of respawn delay
  blinkOn: boolean
}

export interface Bullet {
  pos: Vec2
  vel: Vec2
  lifetime: number   // seconds remaining
  fromUfo: boolean
}

export interface Asteroid {
  id: number
  pos: Vec2
  vel: Vec2
  size: AsteroidSize
  radius: number
  angle: number
  angularVel: number
  vertices: Vec2[]   // offsets from center
}

export interface Ufo {
  pos: Vec2
  vel: Vec2
  active: boolean
  fireTimer: number  // seconds until next shot
  exitTimer: number  // seconds until re-entry (when inactive)
}

export interface StarfieldStar {
  x: number
  y: number
}

export interface GameState {
  status: GameStatus
  ship: Ship
  bullets: Bullet[]
  asteroids: Asteroid[]
  ufo: Ufo | null
  score: number
  highScore: number
  lives: number
  wave: number
  waveTimer: number         // seconds remaining in WAVE_CLEAR pause
  events: GameEvent[]
  asteroidIdCounter: number
}
