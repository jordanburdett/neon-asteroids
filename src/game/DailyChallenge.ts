import { mulberry32 } from '../utils/prng'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const CENTER_X = 400
const CENTER_Y = 300
const MIN_DIST_FROM_CENTER = 150

export function getDailySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function getDailyStorageKey(): string {
  const d = new Date()
  return `na_daily_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function getDayNumber(): number {
  const origin = new Date(2026, 0, 1)
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((todayMidnight.getTime() - origin.getTime()) / (1000 * 60 * 60 * 24))
}

export interface AsteroidSpec {
  x: number
  y: number
  vx: number
  vy: number
  angularVel: number
  vertexSeed: number
}

export interface DailyWaveData {
  seed: number
  asteroids: AsteroidSpec[]
}

export function generateDailyWave(dailySeed: number, waveIndex: number): DailyWaveData {
  const waveSeed = dailySeed * 1000 + waveIndex
  const rand = mulberry32(waveSeed)
  const count = Math.min(4 + waveIndex, 8)
  const asteroids: AsteroidSpec[] = []

  for (let i = 0; i < count; i++) {
    // Try to place asteroid away from center
    let x = 0
    let y = 0
    for (let attempt = 0; attempt < 50; attempt++) {
      const cx = 50 + rand() * (CANVAS_WIDTH - 100)   // 50-750
      const cy = 50 + rand() * (CANVAS_HEIGHT - 100)  // 50-550
      const dx = cx - CENTER_X
      const dy = cy - CENTER_Y
      if (Math.sqrt(dx * dx + dy * dy) >= MIN_DIST_FROM_CENTER) {
        x = cx
        y = cy
        break
      }
    }
    // Fallback: use a known-safe corner-ish position based on index
    if (x === 0 && y === 0) {
      x = (i % 2 === 0) ? 100 : 700
      y = (i < 2) ? 100 : 500
    }

    // Velocity: 40-100px/s in random direction
    const angle = rand() * Math.PI * 2
    const speed = 40 + rand() * 60  // 40-100
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed

    // Angular velocity: -2.5 to 2.5 rad/s
    const angularVel = (rand() * 5) - 2.5

    // Unique vertex seed per asteroid
    const vertexSeed = Math.floor(rand() * 0xFFFFFF)

    asteroids.push({ x, y, vx, vy, angularVel, vertexSeed })
  }

  return { seed: waveSeed, asteroids }
}

export interface DailyRecord {
  completed: boolean
  waveEmojis: string[]
  score: number
  dayNumber: number
  wavesCleared: number
}

export function loadDailyRecord(): DailyRecord | null {
  try {
    const key = getDailyStorageKey()
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as DailyRecord
  } catch {
    return null
  }
}

export function saveDailyRecord(record: DailyRecord): void {
  try {
    const key = getDailyStorageKey()
    localStorage.setItem(key, JSON.stringify(record))
  } catch {
    // ignore storage errors
  }
}

export function buildShareText(record: DailyRecord): string {
  const emojiRow = record.waveEmojis.join('')
  return `Neon Asteroids Daily #${record.dayNumber}\n${emojiRow}\nWave ${record.wavesCleared} — Score: ${record.score}\nactuallyfun.games`
}
