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
} from '@react-vello/types'
import { colorToCss, paintToRgba, rgbaToCss } from './color'
import { resolveCornerRadius } from './geometry'
import { encodeFrame } from './encoder'

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
  context: CanvasRenderingContext2D | null
  root: SceneNode | null
  frameHandle: number | null
  presentationSize: [number, number]
  dpr: number
  onFrame?: (ops: Uint8Array) => void
  softwareRendererActive: boolean
  enableSoftwareRenderer(): void
}

interface RenderState {
  opacity: number
}

const warnedPaintKinds = new Set<string>()
const warnedNodeTypes = new Set<HostType>()

interface ContainerOptions {
  onFrame?: (ops: Uint8Array) => void
  softwareRenderer?: boolean
}

export function createCanvasContainer(canvas: HTMLCanvasElement, options: ContainerOptions = {}): CanvasContainer {
  const shouldAttachContext = options.softwareRenderer ?? true
  let context: CanvasRenderingContext2D | null = null
  let softwareRendererActive = false

  if (shouldAttachContext) {
    context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to acquire 2D context for canvas')
    }
    softwareRendererActive = true
  }

  const container: CanvasContainer = {
    canvas,
    context,
    root: null,
    frameHandle: null,
    presentationSize: [canvas.width, canvas.height],
    dpr: window.devicePixelRatio ?? 1,
    onFrame: options.onFrame,
    softwareRendererActive,
    enableSoftwareRenderer: () => {
      if (container.softwareRendererActive) return
      if (!container.context) {
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn('[rvello] Unable to enable software renderer: failed to acquire 2D context')
          return
        }
        container.context = ctx
      }
      container.softwareRendererActive = true
    },
  }

  return container
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

  const { children: _children, ...rest } = rawProps as HostPropsMap[T] & { children?: unknown }
  return rest as HostPropsMap[T]
}

function renderContainer(container: CanvasContainer): void {
  const { canvas, context: ctx } = container
  const root = container.root

  const drawSoftware = ctx && container.softwareRendererActive

  if (drawSoftware) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (!root || root.type !== 'Canvas') {
    if (drawSoftware) {
      ctx!.restore()
    }
    return
  }

  const canvasNode = root as SceneNode<'Canvas'>
  const props = canvasNode.props
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

  if (drawSoftware) {
    ctx.scale(targetDpr, targetDpr)
    ctx.imageSmoothingEnabled = props.antialiasing !== 'none'

    if (props.backgroundColor) {
      const fillStyle = colorToCss(props.backgroundColor)
      if (fillStyle) {
        ctx.fillStyle = fillStyle
        ctx.fillRect(0, 0, width, height)
      }
    }
  }

  const initialState: RenderState = { opacity: 1 }
  if (drawSoftware) {
    for (const child of canvasNode.children) {
      renderNode(ctx!, child, initialState)
    }

    ctx!.restore()
  }
  container.presentationSize[0] = width
  container.presentationSize[1] = height
  container.dpr = targetDpr

  if (container.onFrame) {
    const encoded = encodeFrame(container)
    if (encoded) {
      container.onFrame(encoded)
    }
  }
}

function renderNode(ctx: CanvasRenderingContext2D, node: SceneNode, state: RenderState): void {
  switch (node.type) {
    case 'Group':
      renderGroup(ctx, node as SceneNode<'Group'>, state)
      break
    case 'Rect':
      renderRect(ctx, node as SceneNode<'Rect'>, state)
      break
    case 'Path':
      renderPath(ctx, node as SceneNode<'Path'>, state)
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

function renderPath(ctx: CanvasRenderingContext2D, node: SceneNode<'Path'>, parentState: RenderState): void {
  if (node.props.visible === false) return

  ctx.save()
  applyTransform(ctx, node.props.transform)

  const opacity = parentState.opacity * (node.props.opacity ?? 1)
  const pathData = node.props.d

  if (!pathData) {
    ctx.restore()
    return
  }

  try {
    const path = new Path2D(pathData)
    const fillRule = node.props.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'

    const fill = resolvePaint(node.props.fill)
    if (fill) {
      ctx.globalAlpha = opacity
      ctx.fillStyle = fill
      ctx.fill(path, fillRule)
    }

    if (node.props.stroke) {
      ctx.globalAlpha = opacity
      applyStroke(ctx, node.props.stroke)
      ctx.stroke(path)
    }
  } catch (error) {
    console.warn('[rvello] Invalid SVG path data:', pathData, error)
  }

  ctx.restore()
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
    const rgba = paintToRgba(paint)
    if (rgba) {
      return rgbaToCss(rgba)
    }
  }

  if (!warnedPaintKinds.has(paint.kind)) {
    warnedPaintKinds.add(paint.kind)
    console.warn(`[rvello] Paint kind "${paint.kind}" is not yet implemented in the preview renderer.`)
  }
  return undefined
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
