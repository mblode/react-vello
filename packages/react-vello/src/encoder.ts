import { type NormalizedRgba, paintToRgba } from './color'
import { resolveCornerRadius } from './geometry'
import { IDENTITY_MATRIX, multiplyTransforms } from './mat3'
import { resolveNodeTransform, resolveRectOrigin, resolveRectSize, resolveTextOrigin } from './nodeProps'
import type { CanvasContainer, SceneNode } from './runtime'
import type { CanvasProps, Mat3, Paint } from './types'

const OpCode = {
  BeginFrame: 1,
  Rect: 2,
  Path: 3,
  Text: 4,
  EndFrame: 255,
} as const

const textEncoder = new TextEncoder()

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

  const targetDpr = canvasProps.devicePixelRatio ?? container.dpr ?? window.devicePixelRatio ?? 1
  const dpr = Number.isFinite(targetDpr) && targetDpr > 0 ? targetDpr : 1
  const [width, height] = container.presentationSize

  writer.writeUint8(OpCode.BeginFrame)
  writer.writeFloat32(width)
  writer.writeFloat32(height)
  writer.writeFloat32(dpr)

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

  const initialState: EncoderState = {
    transform: dpr === 1 ? IDENTITY_MATRIX : ([dpr, 0, 0, dpr, 0, 0] as Mat3),
    opacity: 1,
  }
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
        transform: multiplyTransforms(state.transform, resolveNodeTransform(groupNode.props, groupNode.dragOffset)),
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
    case 'Text':
      encodeText(node as SceneNode<'Text'>, writer, state)
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

  const transform = multiplyTransforms(state.transform, resolveNodeTransform(props, node.dragOffset))
  const opacity = state.opacity * (props.opacity ?? 1)
  const origin = resolveRectOrigin(props)
  const size = resolveRectSize(props)
  const radius = resolveCornerRadius(props.radius, size[0], size[1])

  writer.writeUint8(OpCode.Rect)
  writer.writeFloat32(opacity)
  writeMat3(writer, transform)
  writer.writeFloat32(origin[0])
  writer.writeFloat32(origin[1])
  writer.writeFloat32(size[0])
  writer.writeFloat32(size[1])
  writer.writeFloat32(radius)
  writer.writeFloat32(fill.r)
  writer.writeFloat32(fill.g)
  writer.writeFloat32(fill.b)
  writer.writeFloat32(fill.a)
}

function encodePath(node: SceneNode<'Path'>, writer: BinaryWriter, state: EncoderState): void {
  const props = node.props
  const fill = resolveFill(props.fill)
  if (!(fill || props.stroke)) {
    return
  }

  const transform = multiplyTransforms(state.transform, resolveNodeTransform(props, node.dragOffset))
  const opacity = state.opacity * (props.opacity ?? 1)
  const pathData = props.d || ''
  const fillRule = props.fillRule === 'evenodd' ? 1 : 0

  const pathBytes = textEncoder.encode(pathData)

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

function encodeText(node: SceneNode<'Text'>, writer: BinaryWriter, state: EncoderState): void {
  const props = node.props
  const text = props.text ?? ''
  if (!text) {
    return
  }

  const fill = resolveFill(props.fill) ?? { r: 0, g: 0, b: 0, a: 1 }
  const transform = multiplyTransforms(state.transform, resolveNodeTransform(props, node.dragOffset))
  const opacity = state.opacity * (props.opacity ?? 1)
  const origin = resolveTextOrigin(props)
  const fontSize = props.font?.size ?? 16
  const lineHeight = props.font?.lineHeight ?? 0
  const maxWidth = props.maxWidth ?? 0
  const align = props.align === 'center' ? 1 : props.align === 'end' ? 2 : 0
  const textBytes = textEncoder.encode(text)

  writer.writeUint8(OpCode.Text)
  writer.writeFloat32(opacity)
  writeMat3(writer, transform)
  writer.writeFloat32(origin[0])
  writer.writeFloat32(origin[1])
  writer.writeFloat32(fontSize)
  writer.writeFloat32(lineHeight)
  writer.writeFloat32(maxWidth)
  writer.writeUint8(align)
  writer.writeFloat32(fill.r)
  writer.writeFloat32(fill.g)
  writer.writeFloat32(fill.b)
  writer.writeFloat32(fill.a)
  writer.writeUint32(textBytes.length)
  writer.writeBytes(textBytes)
}

function writeMat3(writer: BinaryWriter, mat: Mat3): void {
  for (let i = 0; i < mat.length; i += 1) {
    writer.writeFloat32(mat[i] ?? 0)
  }
}

function resolveFill(paint?: Paint): NormalizedRgba | null {
  const rgba = paintToRgba(paint)
  if (!rgba) {
    return null
  }
  return rgba
}

function normalizeBackground(background?: CanvasProps['backgroundColor']): Paint | undefined {
  if (!background) {
    return undefined
  }
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
