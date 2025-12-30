import type { RectProps, Vec2 } from './types'

export function resolveCornerRadius(radius: RectProps['radius'], width: number, height: number): number {
  if (!radius) {
    return 0
  }
  if (typeof radius === 'number') {
    return clampRadius(radius, width, height)
  }

  if (Array.isArray(radius)) {
    const first = radius[0]
    if (typeof first === 'number') {
      return clampRadius(first, width, height)
    }
    if (Array.isArray(first)) {
      const candidate = first[0]
      if (typeof candidate === 'number') {
        return clampRadius(candidate, width, height)
      }
    }
  }

  return 0
}

export function clampRadius(radius: number, width: number, height: number): number {
  const maxRadius = Math.min(Math.abs(width), Math.abs(height)) / 2
  return Math.max(0, Math.min(radius, maxRadius))
}

export function normalizeVec2(value: Vec2): readonly [number, number] {
  return [value[0], value[1]]
}
