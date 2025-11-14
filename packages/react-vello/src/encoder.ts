import type { CanvasProps, Mat3, Paint } from '@react-vello/types'
import type { CanvasContainer, SceneNode } from './runtime'
import { paintToRgba, type NormalizedRgba } from './color'
import { resolveCornerRadius } from './geometry'

const OpCode = {
  BeginFrame: 1,
  Rect: 2,
  Path: 3,
  EndFrame: 255,
} as const

const IDENTITY_MATRIX: Mat3 = [1, 0, 0, 1, 0, 0]

interface EncoderState {
  transform: Mat3
  opacity: number
}

export function encodeFrame(container: CanvasContainer): Uint8Array | null {
  const root = container.root
  if (!root || root.type !== 'Canvas') {
    return null
  }

  const writer = new BinaryWriter()
  const canvasNode = root as SceneNode<'Canvas'>
  const canvasProps = canvasNode.props

  writer.writeUint8(OpCode.BeginFrame)
  writer.writeFloat32(canvasProps.width)
  writer.writeFloat32(canvasProps.height)
  writer.writeFloat32(canvasProps.devicePixelRatio ?? window.devicePixelRatio ?? 1)

  const bgPaint = normalizeBackground(canvasProps.backgroundColor)
  const bg = bgPaint ? paintToRgba(bgPaint) : null
  if (bg) {
    writer.writeFloat32(bg.r)
    writer.writeFloat32(bg.g)
    writer.writeFloat32(bg.b)
    writer.writeFloat32(bg.a)
  } else {
    writer.writeFloat32(0)
    writer.writeFloat32(0)
    writer.writeFloat32(0)
    writer.writeFloat32(0)
  }

  const initialState: EncoderState = { transform: IDENTITY_MATRIX, opacity: 1 }
  for (const child of canvasNode.children) {
    encodeNode(child, writer, initialState)
  }

  writer.writeUint8(OpCode.EndFrame)
  return writer.take()
}

function encodeNode(node: SceneNode, writer: BinaryWriter, state: EncoderState): void {
  if ((node.props as { visible?: boolean }).visible === false) {
    return
  }

  switch (node.type) {
    case 'Group': {
      const groupNode = node as SceneNode<'Group'>
      const nextState = {
        transform: multiplyTransforms(state.transform, groupNode.props.transform),
        opacity: state.opacity * (groupNode.props.opacity ?? 1),
      }
      for (const child of groupNode.children) {
        encodeNode(child, writer, nextState)
      }
      break
    }
    case 'Rect':
      encodeRect(node as SceneNode<'Rect'>, writer, state)
      break
    case 'Path':
      encodePath(node as SceneNode<'Path'>, writer, state)
      break
    default:
      // Other primitives will be added as the renderer matures.
      break
  }
}

function encodeRect(node: SceneNode<'Rect'>, writer: BinaryWriter, state: EncoderState): void {
  const props = node.props
  const fill = resolveFill(props.fill)
  if (!fill) {
    return
  }

  const transform = multiplyTransforms(state.transform, props.transform)
  const opacity = state.opacity * (props.opacity ?? 1)
  const radius = resolveCornerRadius(props.radius, props.size[0], props.size[1])

  writer.writeUint8(OpCode.Rect)
  writer.writeFloat32(opacity)
  writeMat3(writer, transform)
  writer.writeFloat32(props.origin[0])
  writer.writeFloat32(props.origin[1])
  writer.writeFloat32(props.size[0])
  writer.writeFloat32(props.size[1])
  writer.writeFloat32(radius)
  writer.writeFloat32(fill.r)
  writer.writeFloat32(fill.g)
  writer.writeFloat32(fill.b)
  writer.writeFloat32(fill.a)
}

function encodePath(node: SceneNode<'Path'>, writer: BinaryWriter, state: EncoderState): void {
  const props = node.props
  const fill = resolveFill(props.fill)
  if (!fill && !props.stroke) {
    return
  }

  const transform = multiplyTransforms(state.transform, props.transform)
  const opacity = state.opacity * (props.opacity ?? 1)
  const pathData = props.d || ''
  const fillRule = props.fillRule === 'evenodd' ? 1 : 0

  const pathBytes = new TextEncoder().encode(pathData)

  writer.writeUint8(OpCode.Path)
  writer.writeFloat32(opacity)
  writeMat3(writer, transform)
  writer.writeUint8(fillRule)

  // Write fill
  if (fill) {
    writer.writeUint8(1) // has fill
    writer.writeFloat32(fill.r)
    writer.writeFloat32(fill.g)
    writer.writeFloat32(fill.b)
    writer.writeFloat32(fill.a)
  } else {
    writer.writeUint8(0) // no fill
  }

  // Write stroke
  if (props.stroke) {
    const strokeColor = resolveFill(props.stroke.paint)
    if (strokeColor) {
      writer.writeUint8(1) // has stroke
      writer.writeFloat32(props.stroke.width)
      writer.writeFloat32(strokeColor.r)
      writer.writeFloat32(strokeColor.g)
      writer.writeFloat32(strokeColor.b)
      writer.writeFloat32(strokeColor.a)
    } else {
      writer.writeUint8(0) // no stroke
    }
  } else {
    writer.writeUint8(0) // no stroke
  }

  // Write path data string
  writer.writeUint32(pathBytes.length)
  writer.writeBytes(pathBytes)
}

function writeMat3(writer: BinaryWriter, mat: Mat3): void {
  for (let i = 0; i < mat.length; i += 1) {
    writer.writeFloat32(mat[i] ?? 0)
  }
}

function resolveFill(paint?: Paint): NormalizedRgba | null {
  const rgba = paintToRgba(paint)
  if (!rgba) return null
  return rgba
}

function multiplyTransforms(parent: Mat3, child?: Mat3): Mat3 {
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

function normalizeBackground(background?: CanvasProps['backgroundColor']): Paint | undefined {
  if (!background) return undefined
  if (typeof background === 'string') {
    return { kind: 'solid', color: background }
  }
  return { kind: 'solid', color: background }
}

class BinaryWriter {
  private view: DataView
  private buffer: ArrayBuffer
  private length = 0

  constructor(initialSize = 1024) {
    this.buffer = new ArrayBuffer(initialSize)
    this.view = new DataView(this.buffer)
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1)
    this.view.setUint8(this.length, value)
    this.length += 1
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4)
    this.view.setFloat32(this.length, value, true)
    this.length += 4
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4)
    this.view.setUint32(this.length, value, true)
    this.length += 4
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length)
    new Uint8Array(this.buffer, this.length, bytes.length).set(bytes)
    this.length += bytes.length
  }

  take(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.length)
  }

  private ensureCapacity(size: number): void {
    const required = this.length + size
    if (required <= this.buffer.byteLength) {
      return
    }

    let nextLength = this.buffer.byteLength * 2
    while (nextLength < required) {
      nextLength *= 2
    }

    const nextBuffer = new ArrayBuffer(nextLength)
    const currentSlice = new Uint8Array(this.buffer, 0, this.length)
    new Uint8Array(nextBuffer, 0, this.length).set(currentSlice)
    this.buffer = nextBuffer
    this.view = new DataView(this.buffer)
  }
}
