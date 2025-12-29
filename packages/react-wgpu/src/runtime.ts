import type {
  CanvasDragEvent,
  CanvasProps,
  CanvasPointerEvent,
  ClipPathProps,
  GroupProps,
  ImageProps,
  LinearGradientProps,
  MaskProps,
  NodeRef,
  NodeProps,
  Paint,
  PathProps,
  RadialGradientProps,
  RectProps,
  SceneNodeHandle,
  TextProps,
  Mat3,
  Vec2,
} from '@react-wgpu/types'
import { colorToCss, paintToRgba, rgbaToCss } from './color'
import { resolveCornerRadius } from './geometry'
import { encodeFrame } from './encoder'
import { IDENTITY_MATRIX, invertTransform, multiplyTransforms, transformPoint } from './mat3'
import {
  resolveHitSlop,
  resolveImageOrigin,
  resolveImageSize,
  resolveNodeTransform,
  resolveRectOrigin,
  resolveRectSize,
  resolveTextOrigin,
} from './nodeProps'

let strictModeEnabled = false

export function setStrictMode(value: boolean): void {
  strictModeEnabled = value
}

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

export interface SceneNode<T extends HostType = HostType> extends NodeRef {
  type: T
  props: HostPropsMap[T]
  children: SceneNode[]
  parent: SceneNode | null
  handle: SceneNodeHandle
  dragOffset: Vec2
  draggingPointerId: number | null
}

let nodeCounter = 0

export function createSceneNode<T extends HostType>(type: T, props: HostPropsMap[T]): SceneNode<T> {
  const handle = { id: `node-${++nodeCounter}` }
  const node: SceneNode<T> = {
    type,
    props,
    children: [],
    parent: null,
    handle,
    id: handle.id,
    dragOffset: [0, 0],
    draggingPointerId: null,
    getLocalTransform: () => getNodeLocalTransform(node),
    getWorldTransform: () => getNodeWorldTransform(node),
    getLocalBounds: () => getNodeLocalBounds(node),
    getWorldBounds: () => getNodeWorldBounds(node),
  }

  return node
}

interface RectHitRegion {
  kind: 'Rect'
  node: SceneNode<'Rect'>
  transform: Mat3
  origin: Vec2
  size: Vec2
  radius: number
}

type HitRegion = RectHitRegion

interface HoverState {
  path: SceneNode[]
  position: Vec2
  localPosition: Vec2
}

interface DragSession {
  node: SceneNode
  pointerId: number
  lastParentPosition: Vec2
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
  hitRegions: HitRegion[]
  hitRegionMap: Map<SceneNode, HitRegion>
  pointerCaptures: Map<number, SceneNode>
  hoverStates: Map<number, HoverState>
  dragSessions: Map<number, DragSession>
  resizeObserver: ResizeObserver | null
  resizeTarget: Element | null
  appliedStyleKeys: Set<string>
}

interface RenderState {
  opacity: number
}

const warnedPaintKinds = new Set<string>()
const warnedNodeTypes = new Set<HostType>()
const pointerHandlerProps: readonly (keyof NodeProps)[] = [
  'onPointerDown',
  'onPointerMove',
  'onPointerUp',
  'onPointerEnter',
  'onPointerLeave',
  'onClick',
  'onWheel',
  'onDragStart',
  'onDragMove',
  'onDragEnd',
]

const WHEEL_POINTER_ID = -1

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
    hitRegions: [],
    hitRegionMap: new Map(),
    pointerCaptures: new Map(),
    hoverStates: new Map(),
    dragSessions: new Map(),
    resizeObserver: null,
    resizeTarget: null,
    appliedStyleKeys: new Set(),
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

  if (!canvas.style.touchAction) {
    canvas.style.touchAction = 'none'
  }

  attachPointerListeners(container)
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
  if (container.root && container.root !== node) {
    container.root.parent = null
  }
  container.root = node
  if (node) {
    node.parent = null
  }
  scheduleRender(container)
}

export function sanitizeProps<T extends HostType>(rawProps: HostPropsMap[T]): HostPropsMap[T] {
  if (!rawProps || typeof rawProps !== 'object') {
    return rawProps
  }

  const { children: _children, ...rest } = rawProps as HostPropsMap[T] & { children?: unknown }
  return rest as HostPropsMap[T]
}

function resolveStrictMode(props?: NodeProps): boolean {
  return props?._useStrictMode ?? strictModeEnabled
}

function getNodeLocalTransform(node: SceneNode): Mat3 {
  return resolveNodeTransform(node.props as NodeProps, node.dragOffset) ?? IDENTITY_MATRIX
}

function getNodeWorldTransform(node: SceneNode | null): Mat3 {
  if (!node) return IDENTITY_MATRIX
  const chain: SceneNode[] = []
  let current: SceneNode | null = node
  while (current) {
    chain.push(current)
    current = current.parent
  }
  let transform = IDENTITY_MATRIX
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    transform = multiplyTransforms(transform, getNodeLocalTransform(chain[i]!))
  }
  return transform
}

function getNodeLocalBounds(node: SceneNode): { origin: Vec2; size: Vec2 } | null {
  switch (node.type) {
    case 'Rect': {
      const rectNode = node as SceneNode<'Rect'>
      return { origin: resolveRectOrigin(rectNode.props), size: resolveRectSize(rectNode.props) }
    }
    case 'Image': {
      const imageNode = node as SceneNode<'Image'>
      return { origin: resolveImageOrigin(imageNode.props), size: resolveImageSize(imageNode.props) }
    }
    case 'Text': {
      return null
    }
    default:
      return null
  }
}

function getNodeWorldBounds(node: SceneNode): { origin: Vec2; size: Vec2 } | null {
  const local = getNodeLocalBounds(node)
  if (!local) return null
  const transform = getNodeWorldTransform(node)
  const [x, y] = local.origin
  const [w, h] = local.size
  const corners: Vec2[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  const transformed = corners.map((corner) => transformPoint(transform, corner))
  let minX = transformed[0]![0]
  let minY = transformed[0]![1]
  let maxX = minX
  let maxY = minY
  for (const [tx, ty] of transformed) {
    minX = Math.min(minX, tx)
    minY = Math.min(minY, ty)
    maxX = Math.max(maxX, tx)
    maxY = Math.max(maxY, ty)
  }
  return { origin: [minX, minY], size: [maxX - minX, maxY - minY] }
}

function getNodeLocalPosition(node: SceneNode, position: Vec2): Vec2 | null {
  const worldTransform = getNodeWorldTransform(node)
  const inverse = invertTransform(worldTransform)
  if (!inverse) return null
  return transformPoint(inverse, position) as Vec2
}

function resolveCanvasSize(container: CanvasContainer, props: CanvasProps): { width: number; height: number } {
  let width = typeof props.width === 'number' ? props.width : undefined
  let height = typeof props.height === 'number' ? props.height : undefined

  const autoSize = props.autoSize === true
  if (autoSize || width === undefined || height === undefined) {
    const parent = container.canvas.parentElement
    if (parent) {
      const rect = parent.getBoundingClientRect()
      if (autoSize || width === undefined) {
        width = rect.width
      }
      if (autoSize || height === undefined) {
        height = rect.height
      }
      ensureResizeObserver(container, parent)
    } else {
      const rect = container.canvas.getBoundingClientRect()
      if (autoSize || width === undefined) {
        width = rect.width
      }
      if (autoSize || height === undefined) {
        height = rect.height
      }
    }
  }

  if (!width || width <= 0) {
    width = container.presentationSize[0] || container.canvas.clientWidth || 1
  }
  if (!height || height <= 0) {
    height = container.presentationSize[1] || container.canvas.clientHeight || 1
  }

  return { width, height }
}

function ensureResizeObserver(container: CanvasContainer, target: Element): void {
  if (typeof ResizeObserver === 'undefined') return
  if (container.resizeObserver && container.resizeTarget === target) return
  container.resizeObserver?.disconnect()
  container.resizeObserver = new ResizeObserver(() => {
    scheduleRender(container)
  })
  container.resizeObserver.observe(target)
  container.resizeTarget = target
}

function applyCanvasAttributes(container: CanvasContainer, props: CanvasProps): void {
  const { canvas } = container
  canvas.className = props.className ?? ''

  if (props.role) {
    canvas.setAttribute('role', props.role)
  } else {
    canvas.removeAttribute('role')
  }

  if (props.title !== undefined) {
    canvas.title = props.title
  } else {
    canvas.removeAttribute('title')
  }

  if (props.ariaLabel !== undefined) {
    canvas.setAttribute('aria-label', props.ariaLabel)
  } else {
    canvas.removeAttribute('aria-label')
  }

  if (props.tabIndex !== undefined) {
    canvas.tabIndex = props.tabIndex
  } else {
    canvas.removeAttribute('tabindex')
  }

  applyCanvasStyle(container, props.style)
}

function applyCanvasStyle(container: CanvasContainer, style?: CanvasProps['style']): void {
  const { canvas, appliedStyleKeys } = container
  const nextStyle = style ?? {}
  const nextKeys = new Set(Object.keys(nextStyle))
  const styleRecord = canvas.style as unknown as Record<string, string>

  for (const key of appliedStyleKeys) {
    if (!nextKeys.has(key)) {
      styleRecord[key] = ''
    }
  }

  for (const [key, value] of Object.entries(nextStyle)) {
    if (value === undefined || value === null) {
      styleRecord[key] = ''
    } else {
      styleRecord[key] = String(value)
    }
  }

  container.appliedStyleKeys = nextKeys
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
    container.hitRegions = []
    container.hitRegionMap.clear()
    return
  }

  const canvasNode = root as SceneNode<'Canvas'>
  const props = canvasNode.props
  const { width, height } = resolveCanvasSize(container, props)
  const targetDpr = props.devicePixelRatio ?? window.devicePixelRatio ?? 1
  const dpr = Number.isFinite(targetDpr) && targetDpr > 0 ? targetDpr : 1
  const deviceWidth = Math.max(1, Math.round(width * dpr))
  const deviceHeight = Math.max(1, Math.round(height * dpr))

  applyCanvasAttributes(container, props)

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth
    canvas.height = deviceHeight
  }

  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  if (drawSoftware) {
    ctx.scale(dpr, dpr)
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
  container.dpr = dpr

  updateHitRegions(container, canvasNode)

  if (container.onFrame) {
    const encoded = encodeFrame(container)
    if (encoded) {
      container.onFrame(encoded)
    }
  }
}

function updateHitRegions(container: CanvasContainer, root: SceneNode<'Canvas'>): void {
  if (!root || !sceneHasPointerHandlers(root)) {
    container.hitRegions = []
    container.hitRegionMap.clear()
    return
  }

  const regions: HitRegion[] = []
  const regionMap = new Map<SceneNode, HitRegion>()
  const initialTransform = IDENTITY_MATRIX

  for (const child of root.children) {
    collectHitRegionsForNode(child, initialTransform, regions, regionMap)
  }

  container.hitRegions = regions
  container.hitRegionMap = regionMap
}

function collectHitRegionsForNode(
  node: SceneNode,
  parentTransform: Mat3,
  regions: HitRegion[],
  regionMap: Map<SceneNode, HitRegion>,
): void {
  if (!isNodeListening(node.props as NodeProps)) {
    return
  }
  if ((node.props as { visible?: boolean }).visible === false) {
    return
  }

  switch (node.type) {
    case 'Group': {
      const groupNode = node as SceneNode<'Group'>
      const nextTransform = multiplyTransforms(
        parentTransform,
        resolveNodeTransform(groupNode.props, groupNode.dragOffset),
      )
      for (const child of groupNode.children) {
        collectHitRegionsForNode(child, nextTransform, regions, regionMap)
      }
      break
    }
    case 'Rect': {
      const rectNode = node as SceneNode<'Rect'>
      const localTransform = resolveNodeTransform(rectNode.props, rectNode.dragOffset)
      const worldTransform = multiplyTransforms(parentTransform, localTransform)
      const origin = resolveRectOrigin(rectNode.props)
      const size = resolveRectSize(rectNode.props)
      const [slopX, slopY] = resolveHitSlop(rectNode.props.hitSlop)
      const paddedOrigin: Vec2 = [origin[0] - slopX, origin[1] - slopY]
      const paddedSize: Vec2 = [size[0] + slopX * 2, size[1] + slopY * 2]
      const radius = resolveCornerRadius(rectNode.props.radius, paddedSize[0], paddedSize[1])
      const region: HitRegion = {
        kind: 'Rect',
        node: rectNode,
        transform: worldTransform,
        origin: paddedOrigin,
        size: paddedSize,
        radius,
      }
      regions.push(region)
      regionMap.set(rectNode, region)
      break
    }
    default: {
      const nextTransform = multiplyTransforms(
        parentTransform,
        resolveNodeTransform(node.props as NodeProps, node.dragOffset),
      )
      for (const child of node.children) {
        collectHitRegionsForNode(child, nextTransform, regions, regionMap)
      }
      break
    }
  }
}

function sceneHasPointerHandlers(node: SceneNode): boolean {
  if (!isNodeListening(node.props as NodeProps)) {
    return false
  }
  if (nodeHasPointerHandler(node.props as HostProps)) {
    return true
  }
  for (const child of node.children) {
    if (sceneHasPointerHandlers(child)) {
      return true
    }
  }
  return false
}

function nodeHasPointerHandler(props: HostProps): boolean {
  if (!isNodeListening(props as NodeProps)) {
    return false
  }
  if ((props as NodeProps).draggable) {
    return true
  }
  const record = props as Partial<Record<keyof NodeProps, unknown>>
  for (const key of pointerHandlerProps) {
    if (typeof record[key] === 'function') {
      return true
    }
  }
  return false
}

function isNodeListening(props: NodeProps): boolean {
  return props.listening !== false
}

type PointerEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'click'
  | 'pointerenter'
  | 'pointerleave'
  | 'wheel'
type PointerLikeEvent = PointerEvent | MouseEvent | WheelEvent

type DragEventType = 'dragstart' | 'dragmove' | 'dragend'

const domEventToHandler: Record<PointerEventType, keyof NodeProps | null> = {
  pointerdown: 'onPointerDown',
  pointermove: 'onPointerMove',
  pointerup: 'onPointerUp',
  pointercancel: 'onPointerUp',
  click: 'onClick',
  pointerenter: null,
  pointerleave: null,
  wheel: 'onWheel',
}

const dragEventToHandler: Record<DragEventType, keyof NodeProps> = {
  dragstart: 'onDragStart',
  dragmove: 'onDragMove',
  dragend: 'onDragEnd',
}

function attachPointerListeners(container: CanvasContainer): void {
  const canvas = container.canvas
  const handleDown = (event: PointerEvent) => handlePointerEvent(container, event, 'pointerdown')
  const handleMove = (event: PointerEvent) => handlePointerEvent(container, event, 'pointermove')
  const handleUp = (event: PointerEvent) => handlePointerEvent(container, event, 'pointerup')
  const handleCancel = (event: PointerEvent) => handlePointerEvent(container, event, 'pointercancel')
  const clickHandler = (event: MouseEvent) => handlePointerEvent(container, event, 'click')
  const leaveHandler = (event: PointerEvent) => {
    clearHoverPath(container, event.pointerId ?? 0, event)
  }
  const wheelHandler = (event: WheelEvent) => handleWheelEvent(container, event)

  canvas.addEventListener('pointerdown', handleDown, { passive: false })
  canvas.addEventListener('pointermove', handleMove, { passive: false })
  canvas.addEventListener('pointerup', handleUp, { passive: false })
  canvas.addEventListener('pointercancel', handleCancel, { passive: false })
  canvas.addEventListener('pointerleave', leaveHandler, { passive: false })
  canvas.addEventListener('click', clickHandler, { passive: false })
  canvas.addEventListener('wheel', wheelHandler, { passive: false })
}

function handlePointerEvent(container: CanvasContainer, nativeEvent: PointerLikeEvent, domType: PointerEventType): void {
  const handlerKey = domEventToHandler[domType]
  if (!handlerKey || !container.root) {
    return
  }

  const pointerId = 'pointerId' in nativeEvent ? nativeEvent.pointerId : 0
  const position = getPointerPosition(container.canvas, nativeEvent)
  const activeDrag = container.dragSessions.get(pointerId)

  if (activeDrag && domType === 'pointermove') {
    updateDragSession(container, activeDrag, nativeEvent, position)
  }

  const capturedNode = container.pointerCaptures.get(pointerId) ?? null
  if (capturedNode && !container.hitRegionMap.has(capturedNode)) {
    container.pointerCaptures.delete(pointerId)
  }

  if (!capturedNode && container.hitRegions.length === 0) {
    if (domType === 'pointermove') {
      updateHoverPath(container, pointerId, null, nativeEvent, position, position)
    }
    return
  }

  let targetRegion: HitRegion | null = null
  let localPoint: Vec2 | null = null

  if (capturedNode) {
    const region = container.hitRegionMap.get(capturedNode)
    if (region) {
      targetRegion = region
      localPoint = getLocalPointForRegion(region, position, true)
    }
  }

  if (!targetRegion) {
    const hit = findHitRegionAtPoint(container.hitRegions, position)
    if (!hit) {
      if (domType === 'pointermove') {
        updateHoverPath(container, pointerId, null, nativeEvent, position, position)
      }
      if (domType === 'pointerup' || domType === 'pointercancel') {
        container.pointerCaptures.delete(pointerId)
      }
      if (domType === 'pointercancel') {
        clearHoverPath(container, pointerId, nativeEvent)
      }
      return
    }
    targetRegion = hit.region
    localPoint = hit.localPoint
  }

  if (!targetRegion) {
    return
  }

  const targetNode = targetRegion.node
  let localPosition = (localPoint ?? position) as Vec2
  if (targetNode.draggingPointerId !== null) {
    localPosition = getNodeLocalPosition(targetNode, position) ?? localPosition
  }
  if (domType === 'pointermove' || domType === 'pointerdown') {
    updateHoverPath(container, pointerId, targetNode, nativeEvent, position, localPosition)
  }
  const state = createPointerEventState({
    container,
    nativeEvent,
    pointerId,
    domType,
    position,
    localPosition,
    target: targetNode,
  })

  bubblePointerEvent(targetNode, handlerKey, state)

  if (domType === 'pointerdown') {
    beginDragSession(container, targetNode, nativeEvent, position, localPosition, pointerId)
  }

  if (domType === 'pointerup' || domType === 'pointercancel') {
    const captured = container.pointerCaptures.get(pointerId)
    container.pointerCaptures.delete(pointerId)
    if (captured && typeof container.canvas.releasePointerCapture === 'function') {
      try {
        container.canvas.releasePointerCapture(pointerId)
      } catch {
        // ignore release errors
      }
    }
  }

  if (activeDrag && (domType === 'pointerup' || domType === 'pointercancel')) {
    endDragSession(container, activeDrag, nativeEvent, position, domType === 'pointercancel')
  }
  if (domType === 'pointercancel') {
    clearHoverPath(container, pointerId, nativeEvent)
  }
}

function handleWheelEvent(container: CanvasContainer, nativeEvent: WheelEvent): void {
  if (!container.root) {
    return
  }
  const position = getPointerPosition(container.canvas, nativeEvent)
  const hit = findHitRegionAtPoint(container.hitRegions, position)
  if (!hit) {
    return
  }
  const targetNode = hit.region.node
  const localPosition = hit.localPoint
  const delta = [nativeEvent.deltaX, nativeEvent.deltaY] as Vec2
  const state = createPointerEventState({
    container,
    nativeEvent,
    pointerId: WHEEL_POINTER_ID,
    domType: 'wheel',
    position,
    localPosition,
    target: targetNode,
    delta,
  })
  bubblePointerEvent(targetNode, 'onWheel', state)
}

function beginDragSession(
  container: CanvasContainer,
  targetNode: SceneNode,
  nativeEvent: PointerLikeEvent,
  position: Vec2,
  localPosition: Vec2,
  pointerId: number,
): void {
  const targetProps = targetNode.props as NodeProps
  if (!targetProps.draggable || !isNodeListening(targetProps)) {
    return
  }
  if (targetNode.draggingPointerId !== null) {
    return
  }

  if (resolveStrictMode(targetProps)) {
    targetNode.dragOffset = [0, 0]
  }

  const parentPosition = getParentLocalPosition(targetNode, position)
  const session: DragSession = { node: targetNode, pointerId, lastParentPosition: parentPosition }
  container.dragSessions.set(pointerId, session)
  targetNode.draggingPointerId = pointerId

  container.pointerCaptures.set(pointerId, targetNode)
  if (nativeEvent instanceof PointerEvent && typeof container.canvas.setPointerCapture === 'function') {
    try {
      container.canvas.setPointerCapture(pointerId)
    } catch {
      // ignore capture errors
    }
  }

  const resolvedLocal = getNodeLocalPosition(targetNode, position) ?? localPosition
  const state = createDragEventState({
    container,
    nativeEvent,
    pointerId,
    eventType: 'dragstart',
    position,
    localPosition: resolvedLocal,
    target: targetNode,
    delta: [0, 0],
  })
  bubbleDragEvent(targetNode, dragEventToHandler.dragstart, state)
  scheduleRender(container)
}

function updateDragSession(
  container: CanvasContainer,
  session: DragSession,
  nativeEvent: PointerLikeEvent,
  position: Vec2,
): void {
  const node = session.node
  const nodeProps = node.props as NodeProps
  if (!nodeProps.draggable || !isNodeListening(nodeProps)) {
    endDragSession(container, session, nativeEvent, position, true)
    return
  }

  const parentPosition = getParentLocalPosition(node, position)
  const delta: Vec2 = [
    parentPosition[0] - session.lastParentPosition[0],
    parentPosition[1] - session.lastParentPosition[1],
  ]

  if (delta[0] === 0 && delta[1] === 0) {
    return
  }

  node.dragOffset = [node.dragOffset[0] + delta[0], node.dragOffset[1] + delta[1]]
  session.lastParentPosition = parentPosition

  const resolvedLocal = getNodeLocalPosition(node, position) ?? position
  const state = createDragEventState({
    container,
    nativeEvent,
    pointerId: session.pointerId,
    eventType: 'dragmove',
    position,
    localPosition: resolvedLocal,
    target: node,
    delta,
  })
  bubbleDragEvent(node, dragEventToHandler.dragmove, state)
  scheduleRender(container)
}

function endDragSession(
  container: CanvasContainer,
  session: DragSession,
  nativeEvent: PointerLikeEvent,
  position: Vec2,
  cancelled: boolean,
): void {
  const node = session.node
  container.dragSessions.delete(session.pointerId)
  if (node.draggingPointerId === session.pointerId) {
    node.draggingPointerId = null
  }

  const resolvedLocal = getNodeLocalPosition(node, position) ?? position
  const state = createDragEventState({
    container,
    nativeEvent,
    pointerId: session.pointerId,
    eventType: 'dragend',
    position,
    localPosition: resolvedLocal,
    target: node,
    delta: [0, 0],
  })
  bubbleDragEvent(node, dragEventToHandler.dragend, state)

  if (cancelled || resolveStrictMode(node.props as NodeProps)) {
    node.dragOffset = [0, 0]
  }
  scheduleRender(container)
}

function getParentLocalPosition(node: SceneNode, position: Vec2): Vec2 {
  const parentTransform = getNodeWorldTransform(node.parent)
  const inverse = invertTransform(parentTransform)
  if (!inverse) return position
  return transformPoint(inverse, position) as Vec2
}

interface DragEventState {
  event: CanvasDragEvent
  isPropagationStopped(): boolean
  setCurrentTarget(node: SceneNode | null): void
}

function createDragEventState(params: {
  container: CanvasContainer
  nativeEvent: PointerLikeEvent
  pointerId: number
  eventType: DragEventType
  position: Vec2
  localPosition: Vec2
  target: SceneNode
  delta: Vec2
}): DragEventState {
  const { container, nativeEvent, pointerId, eventType, position, localPosition, target, delta } = params
  let propagationStopped = false
  let currentTarget: SceneNode | null = target

  const event: CanvasDragEvent = {
    type: eventType,
    timestamp: nativeEvent.timeStamp,
    pointerId,
    devicePixelRatio: container.dpr,
    position,
    localPosition,
    buttons: 'buttons' in nativeEvent ? nativeEvent.buttons : 0,
    modifiers: {
      alt: Boolean(nativeEvent.altKey),
      ctrl: Boolean(nativeEvent.ctrlKey),
      meta: Boolean(nativeEvent.metaKey),
      shift: Boolean(nativeEvent.shiftKey),
    },
    target: target.handle,
    delta,
    stopPropagation() {
      propagationStopped = true
    },
    preventDefault() {
      if (typeof nativeEvent.preventDefault === 'function') {
        nativeEvent.preventDefault()
      }
    },
    capturePointer(id: number) {
      if (!(nativeEvent instanceof PointerEvent)) return
      const owner = currentTarget ?? target
      container.pointerCaptures.set(id, owner)
      if (typeof container.canvas.setPointerCapture === 'function') {
        try {
          container.canvas.setPointerCapture(id)
        } catch {
          // ignore capture errors
        }
      }
    },
    releasePointerCapture(id: number) {
      if (!(nativeEvent instanceof PointerEvent)) return
      const owner = currentTarget ?? target
      const captured = container.pointerCaptures.get(id)
      if (captured && captured === owner) {
        container.pointerCaptures.delete(id)
      }
      if (typeof container.canvas.releasePointerCapture === 'function') {
        try {
          container.canvas.releasePointerCapture(id)
        } catch {
          // ignore release errors
        }
      }
    },
  }

  return {
    event,
    isPropagationStopped: () => propagationStopped,
    setCurrentTarget(node: SceneNode | null) {
      currentTarget = node
    },
  }
}

function bubbleDragEvent(target: SceneNode, handlerKey: keyof NodeProps, state: DragEventState): void {
  let current: SceneNode | null = target
  while (current) {
    const handler = (current.props as Partial<Record<keyof NodeProps, unknown>>)[handlerKey]
    if (typeof handler === 'function') {
      state.setCurrentTarget(current)
      ;(handler as (event: CanvasDragEvent) => void)(state.event)
    }
    if (state.isPropagationStopped()) {
      break
    }
    current = current.parent
  }
  state.setCurrentTarget(null)
}

interface PointerEventState {
  event: CanvasPointerEvent
  isPropagationStopped(): boolean
  setCurrentTarget(node: SceneNode | null): void
}

function createPointerEventState(params: {
  container: CanvasContainer
  nativeEvent: PointerLikeEvent
  pointerId: number
  domType: PointerEventType
  position: Vec2
  localPosition: Vec2
  target: SceneNode
  delta?: Vec2
}): PointerEventState {
  const { container, nativeEvent, pointerId, domType, position, localPosition, target, delta } = params
  let propagationStopped = false
  let currentTarget: SceneNode | null = target

  const eventType: CanvasPointerEvent['type'] = domType === 'pointercancel' ? 'pointerup' : domType

  const event: CanvasPointerEvent = {
    type: eventType,
    timestamp: nativeEvent.timeStamp,
    pointerId,
    devicePixelRatio: container.dpr,
    position,
    localPosition,
    buttons: 'buttons' in nativeEvent ? nativeEvent.buttons : 0,
    modifiers: {
      alt: Boolean(nativeEvent.altKey),
      ctrl: Boolean(nativeEvent.ctrlKey),
      meta: Boolean(nativeEvent.metaKey),
      shift: Boolean(nativeEvent.shiftKey),
    },
    target: target.handle,
    delta: delta ?? ([0, 0] as Vec2),
    stopPropagation() {
      propagationStopped = true
    },
    preventDefault() {
      if (typeof nativeEvent.preventDefault === 'function') {
        nativeEvent.preventDefault()
      }
    },
    capturePointer(id: number) {
      if (!(nativeEvent instanceof PointerEvent)) return
      const owner = currentTarget ?? target
      container.pointerCaptures.set(id, owner)
      if (typeof container.canvas.setPointerCapture === 'function') {
        try {
          container.canvas.setPointerCapture(id)
        } catch {
          // ignore capture errors
        }
      }
    },
    releasePointerCapture(id: number) {
      if (!(nativeEvent instanceof PointerEvent)) return
      const owner = currentTarget ?? target
      const captured = container.pointerCaptures.get(id)
      if (captured && captured === owner) {
        container.pointerCaptures.delete(id)
      }
      if (typeof container.canvas.releasePointerCapture === 'function') {
        try {
          container.canvas.releasePointerCapture(id)
        } catch {
          // ignore release errors
        }
      }
    },
  }

  return {
    event,
    isPropagationStopped: () => propagationStopped,
    setCurrentTarget(node: SceneNode | null) {
      currentTarget = node
    },
  }
}

function bubblePointerEvent(target: SceneNode, handlerKey: keyof NodeProps, state: PointerEventState): void {
  let current: SceneNode | null = target
  while (current) {
    const handler = (current.props as Partial<Record<keyof NodeProps, unknown>>)[handlerKey]
    if (typeof handler === 'function') {
      state.setCurrentTarget(current)
      ;(handler as (event: CanvasPointerEvent) => void)(state.event)
    }
    if (state.isPropagationStopped()) {
      break
    }
    current = current.parent
  }
  state.setCurrentTarget(null)
}

function updateHoverPath(
  container: CanvasContainer,
  pointerId: number,
  target: SceneNode | null,
  nativeEvent: PointerLikeEvent,
  position: Vec2,
  localPosition: Vec2,
): void {
  const previous = container.hoverStates.get(pointerId)
  const prevPath = previous?.path ?? []
  const nextPath = buildNodePath(target)
  const leavePosition = previous?.position ?? position
  const leaveLocal = previous?.localPosition ?? localPosition

  let shared = 0
  while (shared < prevPath.length && shared < nextPath.length && prevPath[shared] === nextPath[shared]) {
    shared += 1
  }

  for (let i = prevPath.length - 1; i >= shared; i -= 1) {
    const leaveNode = prevPath[i]
    if (!leaveNode) continue
    dispatchDirectPointerEvent(
      container,
      leaveNode,
      'onPointerLeave',
      nativeEvent,
      'pointerleave',
      pointerId,
      leavePosition,
      leaveLocal,
    )
  }

  for (let i = shared; i < nextPath.length; i += 1) {
    const enterNode = nextPath[i]
    if (!enterNode) continue
    dispatchDirectPointerEvent(
      container,
      enterNode,
      'onPointerEnter',
      nativeEvent,
      'pointerenter',
      pointerId,
      position,
      localPosition,
    )
  }

  if (nextPath.length > 0) {
    container.hoverStates.set(pointerId, { path: nextPath, position, localPosition })
  } else {
    container.hoverStates.delete(pointerId)
  }
}

function clearHoverPath(container: CanvasContainer, pointerId: number, nativeEvent: PointerLikeEvent): void {
  const previous = container.hoverStates.get(pointerId)
  if (!previous) return
  container.hoverStates.delete(pointerId)
  const path = previous.path
  const position = getPointerPosition(container.canvas, nativeEvent)
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const leaveNode = path[i]
    if (!leaveNode) continue
    dispatchDirectPointerEvent(
      container,
      leaveNode,
      'onPointerLeave',
      nativeEvent,
      'pointerleave',
      pointerId,
      position,
      previous.localPosition,
    )
  }
}

function dispatchDirectPointerEvent(
  container: CanvasContainer,
  node: SceneNode | null,
  handlerKey: keyof NodeProps,
  nativeEvent: PointerLikeEvent,
  eventType: PointerEventType,
  pointerId: number,
  position: Vec2,
  localPosition: Vec2,
): void {
  if (!node) return
  const handler = (node.props as Partial<Record<keyof NodeProps, unknown>>)[handlerKey]
  if (typeof handler !== 'function') {
    return
  }
  const state = createPointerEventState({
    container,
    nativeEvent,
    pointerId,
    domType: eventType,
    position,
    localPosition,
    target: node,
  })
  state.setCurrentTarget(node)
  ;(handler as (event: CanvasPointerEvent) => void)(state.event)
  state.setCurrentTarget(null)
}

function buildNodePath(node: SceneNode | null): SceneNode[] {
  if (!node) return []
  const path: SceneNode[] = []
  let current: SceneNode | null = node
  while (current) {
    path.push(current)
    current = current.parent
  }
  path.reverse()
  return path
}

function findHitRegionAtPoint(
  regions: HitRegion[],
  point: Vec2,
): { region: HitRegion; localPoint: Vec2 } | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i]
    if (!region) continue
    const local = getLocalPointForRegion(region, point)
    if (local) {
      return { region, localPoint: local }
    }
  }
  return null
}

function getLocalPointForRegion(region: HitRegion, point: Vec2, skipBounds = false): Vec2 | null {
  const inverse = invertTransform(region.transform)
  if (!inverse) return null
  const local = transformPoint(inverse, point) as Vec2
  if (skipBounds) return local

  switch (region.kind) {
    case 'Rect':
      return pointInRectRegion(local, region) ? local : null
    default:
      return null
  }
}

function pointInRectRegion(point: Vec2, region: RectHitRegion): boolean {
  const [px, py] = point
  const [ox, oy] = region.origin
  const [width, height] = region.size
  if (px < ox || py < oy || px > ox + width || py > oy + height) {
    return false
  }
  const radius = region.radius
  if (radius <= 0) {
    return true
  }

  const clampedRadius = Math.min(radius, Math.min(Math.abs(width), Math.abs(height)) / 2)
  const right = ox + width
  const bottom = oy + height

  if (px < ox + clampedRadius && py < oy + clampedRadius) {
    return pointInsideCircle(px, py, ox + clampedRadius, oy + clampedRadius, clampedRadius)
  }
  if (px > right - clampedRadius && py < oy + clampedRadius) {
    return pointInsideCircle(px, py, right - clampedRadius, oy + clampedRadius, clampedRadius)
  }
  if (px < ox + clampedRadius && py > bottom - clampedRadius) {
    return pointInsideCircle(px, py, ox + clampedRadius, bottom - clampedRadius, clampedRadius)
  }
  if (px > right - clampedRadius && py > bottom - clampedRadius) {
    return pointInsideCircle(px, py, right - clampedRadius, bottom - clampedRadius, clampedRadius)
  }

  return true
}

function pointInsideCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

function getPointerPosition(canvas: HTMLCanvasElement, event: PointerLikeEvent): Vec2 {
  const rect = canvas.getBoundingClientRect()
  return [event.clientX - rect.left, event.clientY - rect.top] as Vec2
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
    case 'Text':
      renderText(ctx, node as SceneNode<'Text'>, state)
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
  applyCanvasTransform(ctx, resolveNodeTransform(node.props, node.dragOffset))
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
  applyCanvasTransform(ctx, resolveNodeTransform(node.props, node.dragOffset))

  const opacity = parentState.opacity * (node.props.opacity ?? 1)
  const [x, y] = resolveRectOrigin(node.props)
  const [width, height] = resolveRectSize(node.props)
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
  applyCanvasTransform(ctx, resolveNodeTransform(node.props, node.dragOffset))

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

function renderText(ctx: CanvasRenderingContext2D, node: SceneNode<'Text'>, parentState: RenderState): void {
  if (node.props.visible === false) return

  const { text, font, align, maxWidth } = node.props
  const origin = resolveTextOrigin(node.props)
  if (!text) return

  ctx.save()
  applyCanvasTransform(ctx, resolveNodeTransform(node.props, node.dragOffset))

  const opacity = parentState.opacity * (node.props.opacity ?? 1)
  const fillStyle = resolvePaint(node.props.fill) ?? rgbaToCss({ r: 0, g: 0, b: 0, a: 1 })
  ctx.globalAlpha = opacity
  ctx.fillStyle = fillStyle

  const fontSize = font?.size ?? 16
  const fontStyle = font?.style ?? 'normal'
  const fontWeight = font?.weight ?? 'normal'
  const fontFamily = font?.family ?? 'sans-serif'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const metrics = ctx.measureText('Mg')
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2
  const lineHeight = font?.lineHeight ?? ascent + descent

  const lines = wrapTextLines(ctx, text, maxWidth)
  let y = origin[1] + ascent
  for (const line of lines) {
    const offsetX = alignOffset(align, maxWidth ?? 0, line.width)
    ctx.fillText(line.text, origin[0] + offsetX, y)
    y += lineHeight
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

function applyCanvasTransform(ctx: CanvasRenderingContext2D, transform?: Mat3): void {
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

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth?: number,
): { text: string; width: number }[] {
  const lines: { text: string; width: number }[] = []
  const rawLines = text.split(/\r?\n/)
  const wrap = Boolean(maxWidth && maxWidth > 0)

  for (const rawLine of rawLines) {
    if (!wrap) {
      const width = ctx.measureText(rawLine).width
      lines.push({ text: rawLine, width })
      continue
    }

    const words = rawLine.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push({ text: '', width: 0 })
      continue
    }

    let current = ''
    let currentWidth = 0

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      const nextWidth = ctx.measureText(next).width
      if (!current || nextWidth <= (maxWidth ?? 0)) {
        current = next
        currentWidth = nextWidth
      } else {
        lines.push({ text: current, width: currentWidth })
        current = word
        currentWidth = ctx.measureText(word).width
      }
    }

    if (current) {
      lines.push({ text: current, width: currentWidth })
    }
  }

  return lines
}

function alignOffset(align: TextProps['align'], maxWidth: number, lineWidth: number): number {
  const width = maxWidth > 0 ? maxWidth : lineWidth
  if (align === 'center') {
    return (width - lineWidth) / 2
  }
  if (align === 'end') {
    return width - lineWidth
  }
  return 0
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
