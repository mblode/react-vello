import { IDENTITY_MATRIX, multiplyTransforms } from './mat3'
import type { ImageProps, Mat3, NodeProps, RectProps, TextProps, Vec2 } from './types'

const ZERO_VEC2: Vec2 = [0, 0]

export function resolveNodeTransform(props: NodeProps, dragOffset?: Vec2): Mat3 | undefined {
  const baseTransform = props.transform
  const shorthand = resolveShorthandTransform(props)

  let transform = baseTransform
  if (shorthand) {
    transform = transform ? multiplyTransforms(transform, shorthand) : shorthand
  }

  if (dragOffset && (dragOffset[0] !== 0 || dragOffset[1] !== 0)) {
    const dragTransform: Mat3 = [1, 0, 0, 1, dragOffset[0], dragOffset[1]]
    transform = transform ? multiplyTransforms(dragTransform, transform) : dragTransform
  }

  return transform ?? undefined
}

export function resolveRectOrigin(props: RectProps): Vec2 {
  return props.origin ?? ZERO_VEC2
}

export function resolveRectSize(props: RectProps): Vec2 {
  if (props.size) {
    return props.size
  }
  const width = props.width ?? 0
  const height = props.height ?? 0
  return [width, height]
}

export function resolveTextOrigin(props: TextProps): Vec2 {
  return props.origin ?? ZERO_VEC2
}

export function resolveImageOrigin(props: ImageProps): Vec2 {
  return props.origin ?? ZERO_VEC2
}

export function resolveImageSize(props: ImageProps): Vec2 {
  if (props.size) {
    return props.size
  }
  const width = props.width ?? 0
  const height = props.height ?? 0
  return [width, height]
}

export function resolveHitSlop(hitSlop?: number | Vec2): Vec2 {
  if (!hitSlop) {
    return ZERO_VEC2
  }
  if (typeof hitSlop === 'number') {
    return [hitSlop, hitSlop]
  }
  return hitSlop
}

function resolveShorthandTransform(props: NodeProps): Mat3 | null {
  const hasShorthand =
    props.x !== undefined ||
    props.y !== undefined ||
    props.rotation !== undefined ||
    props.scaleX !== undefined ||
    props.scaleY !== undefined ||
    props.offset !== undefined ||
    props.offsetX !== undefined ||
    props.offsetY !== undefined

  if (!hasShorthand) {
    return null
  }

  const x = props.x ?? 0
  const y = props.y ?? 0
  const scaleX = props.scaleX ?? 1
  const scaleY = props.scaleY ?? 1

  const angle = (props.rotation ?? 0) * (Math.PI / 180)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const offset = props.offset
  const offsetX = offset?.[0] ?? props.offsetX ?? 0
  const offsetY = offset?.[1] ?? props.offsetY ?? 0

  const a = cos * scaleX
  const b = sin * scaleX
  const c = -sin * scaleY
  const d = cos * scaleY
  const e = x - offsetX * a - offsetY * c
  const f = y - offsetX * b - offsetY * d

  const transform: Mat3 = [a, b, c, d, e, f]
  if (!props.transform && transform.every((value, index) => value === IDENTITY_MATRIX[index])) {
    return null
  }
  return transform
}
