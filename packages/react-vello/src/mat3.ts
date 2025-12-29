import type { Mat3, Vec2 } from '@react-vello/types'

export const IDENTITY_MATRIX: Mat3 = [1, 0, 0, 1, 0, 0]

export function multiplyTransforms(parent: Mat3, child?: Mat3): Mat3 {
  const c = child ?? IDENTITY_MATRIX
  const a0 = parent[0]
  const a1 = parent[1]
  const a2 = parent[2]
  const a3 = parent[3]
  const a4 = parent[4]
  const a5 = parent[5]

  const b0 = c[0]
  const b1 = c[1]
  const b2 = c[2]
  const b3 = c[3]
  const b4 = c[4]
  const b5 = c[5]

  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ] as Mat3
}

export function invertTransform(transform: Mat3): Mat3 | null {
  const [a, b, c, d, e, f] = transform
  const det = a * d - b * c
  if (Math.abs(det) < 1e-8) {
    return null
  }
  const invDet = 1 / det
  const na = d * invDet
  const nb = -b * invDet
  const nc = -c * invDet
  const nd = a * invDet
  const ne = -(na * e + nc * f)
  const nf = -(nb * e + nd * f)
  return [na, nb, nc, nd, ne, nf] as Mat3
}

export function transformPoint(transform: Mat3, point: Vec2): Vec2 {
  const [a, b, c, d, e, f] = transform
  const [x, y] = point
  return [a * x + c * y + e, b * x + d * y + f]
}
