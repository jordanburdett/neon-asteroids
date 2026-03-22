import type { Vec2 } from '../game/types'

export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s }
}

export function rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  }
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

export function wrapPosition(pos: Vec2, width: number, height: number): Vec2 {
  let x = pos.x
  let y = pos.y
  if (x < 0) x += width
  if (x > width) x -= width
  if (y < 0) y += height
  if (y > height) y -= height
  return { x, y }
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randomSign(): number {
  return Math.random() < 0.5 ? 1 : -1
}
