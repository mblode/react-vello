import type {
  CanvasProps,
  ClipPathProps,
  GroupProps,
  ImageProps,
  LinearGradientProps,
  MaskProps,
  Paint,
  PathProps,
  RadialGradientProps,
  RectProps,
  TextProps,
  Mat3,
  RgbaColor,
} from '@react-vello/types'

export type HostType =
  | 'Canvas'
  | 'Group'
  | 'Rect'
  | 'Path'
  | 'Text'
  | 'Image'
  | 'LinearGradient'
  | 'RadialGradient'
  | 'Mask'
  | 'ClipPath'

export type HostPropsMap = {
  Canvas: CanvasProps
  Group: GroupProps
  Rect: RectProps
  Path: PathProps
  Text: TextProps
  Image: ImageProps
  LinearGradient: LinearGradientProps
  RadialGradient: RadialGradientProps
  Mask: MaskProps
  ClipPath: ClipPathProps
}

export type HostProps = HostPropsMap[HostType]

export interface SceneNode<T extends HostType = HostType> {
  type: T
  props: HostPropsMap[T]
  children: SceneNode[]
}

export interface CanvasContainer {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  root: SceneNode | null
  frameHandle: number | null
  presentationSize: [number, number]
  dpr: number
}

interface RenderState {
  opacity: number
}

const warnedPaintKinds = new Set<string>()
const warnedNodeTypes = new Set<HostType>()

export function createCanvasContainer(canvas: HTMLCanvasElement): CanvasContainer {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to acquire 2D context for canvas')
  }

  return {
    canvas,
    context,
    root: null,
    frameHandle: null,
    presentationSize: [canvas.width, canvas.height],
    dpr: window.devicePixelRatio ?? 1,
  }
}

export function scheduleRender(container: CanvasContainer): void {
  if (container.frameHandle !== null) {
    return
  }

  container.frameHandle = requestAnimationFrame(() => {
    container.frameHandle = null
    renderContainer(container)
  })
}

export function setRootNode(container: CanvasContainer, node: SceneNode | null): void {
  container.root = node
  scheduleRender(container)
}

export function sanitizeProps<T extends HostType>(rawProps: HostPropsMap[T]): HostPropsMap[T] {
  if (!rawProps || typeof rawProps !== 'object') {
    return rawProps
  }

  const clone = { ...(rawProps as Record<string, unknown>) }
  delete clone.children
  return clone as HostPropsMap[T]
}

function renderContainer(container: CanvasContainer): void {
  const { canvas, context: ctx } = container
  const root = container.root

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!root || root.type !== 'Canvas') {
    ctx.restore()
    return
  }

  const props = root.props
  const width = props.width
  const height = props.height
  const targetDpr = props.devicePixelRatio ?? window.devicePixelRatio ?? 1
  const deviceWidth = Math.max(1, Math.round(width * targetDpr))
  const deviceHeight = Math.max(1, Math.round(height * targetDpr))

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth
    canvas.height = deviceHeight
  }

  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.scale(targetDpr, targetDpr)
  ctx.imageSmoothingEnabled = props.antialiasing !== 'none'

  if (props.backgroundColor) {
    const fillStyle = colorToCss(props.backgroundColor)
    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.fillRect(0, 0, width, height)
    }
  }

  const initialState: RenderState = { opacity: 1 }
  for (const child of root.children) {
    renderNode(ctx, child, initialState)
  }

  ctx.restore()
  container.presentationSize[0] = width
  container.presentationSize[1] = height
  container.dpr = targetDpr
}

function renderNode(ctx: CanvasRenderingContext2D, node: SceneNode, state: RenderState): void {
  switch (node.type) {
    case 'Group':
      renderGroup(ctx, node, state)
      break
    case 'Rect':
      renderRect(ctx, node, state)
      break
    default:
      if (!warnedNodeTypes.has(node.type)) {
        warnedNodeTypes.add(node.type)
        console.warn(`[rvello] Node type "${node.type}" is not yet implemented in the preview renderer.`)
      }
      break
  }
}

function renderGroup(ctx: CanvasRenderingContext2D, node: SceneNode<'Group'>, parentState: RenderState): void {
  if (node.props.visible === false) return

  ctx.save()
  applyTransform(ctx, node.props.transform)
  const opacity = parentState.opacity * (node.props.opacity ?? 1)
  const nextState: RenderState = { opacity }

  for (const child of node.children) {
    renderNode(ctx, child, nextState)
  }

  ctx.restore()
}

function renderRect(ctx: CanvasRenderingContext2D, node: SceneNode<'Rect'>, parentState: RenderState): void {
  if (node.props.visible === false) return

  ctx.save()
  applyTransform(ctx, node.props.transform)

  const opacity = parentState.opacity * (node.props.opacity ?? 1)
  const [x, y] = node.props.origin
  const [width, height] = node.props.size
  const radius = resolveCornerRadius(node.props.radius, width, height)

  ctx.beginPath()
  drawRoundedRectPath(ctx, x, y, width, height, radius)

  const fill = resolvePaint(node.props.fill)
  if (fill) {
    ctx.globalAlpha = opacity
    ctx.fillStyle = fill
    ctx.fill()
  }

  if (node.props.stroke) {
    ctx.globalAlpha = opacity
    applyStroke(ctx, node.props.stroke)
    ctx.stroke()
  }

  ctx.restore()
}

function resolveCornerRadius(radius: RectProps['radius'], width: number, height: number): number {
  if (!radius) return 0
  if (typeof radius === 'number') return clampRadius(radius, width, height)

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

function clampRadius(radius: number, width: number, height: number): number {
  const maxRadius = Math.min(Math.abs(width), Math.abs(height)) / 2
  return Math.max(0, Math.min(radius, maxRadius))
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: RectProps['stroke']): void {
  if (!stroke) return

  const strokeStyle = resolvePaint(stroke.paint)
  if (!strokeStyle) return

  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = stroke.width
  ctx.lineJoin = stroke.join ?? 'miter'
  ctx.lineCap = stroke.cap ?? 'butt'
  ctx.miterLimit = stroke.miterLimit ?? 10
  if (stroke.dash) {
    ctx.setLineDash(stroke.dash as number[])
  } else {
    ctx.setLineDash([])
  }
}

function applyTransform(ctx: CanvasRenderingContext2D, transform?: Mat3): void {
  if (!transform) return
  const [a, b, c, d, e, f] = transform
  ctx.transform(a, b, c, d, e, f)
}

function resolvePaint(paint?: Paint): string | undefined {
  if (!paint) return undefined
  if (paint.kind === 'solid') {
    return colorToCss(paint.color)
  }

  if (!warnedPaintKinds.has(paint.kind)) {
    warnedPaintKinds.add(paint.kind)
    console.warn(`[rvello] Paint kind "${paint.kind}" is not yet implemented in the preview renderer.`)
  }
  return undefined
}

function colorToCss(color: string | RgbaColor | undefined): string | undefined {
  if (!color) return undefined
  if (typeof color === 'string') return color
  const { r, g, b } = normalizeChannelTriplet(color)
  const alpha = clamp01(color.a ?? 1)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function normalizeChannelTriplet(color: RgbaColor): readonly [number, number, number] {
  const convert = (value: number) => {
    if (value <= 1) return Math.round(clamp01(value) * 255)
    return Math.round(Math.min(255, Math.max(0, value)))
  }
  return [convert(color.r), convert(color.g), convert(color.b)]
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (radius <= 0) {
    ctx.rect(x, y, width, height)
    return
  }

  const r = Math.min(radius, Math.min(Math.abs(width), Math.abs(height)) / 2)
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
