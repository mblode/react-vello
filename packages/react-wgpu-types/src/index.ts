import type { CSSProperties, ReactNode } from 'react'

export type Vec2 = readonly [number, number]
export type Mat3 = readonly [number, number, number, number, number, number]

export interface RgbaColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface Stroke {
  width: number
  paint: Paint
  join?: 'miter' | 'bevel' | 'round'
  cap?: 'butt' | 'square' | 'round'
  miterLimit?: number
  dash?: readonly number[]
}

export type SolidPaint = { kind: 'solid'; color: string | RgbaColor }
export type GradientPaint = { kind: 'gradient'; ref: string }
export type ImagePaint = { kind: 'image'; nodeId: string }
export type Paint = SolidPaint | GradientPaint | ImagePaint

export interface SceneNodeHandle {
  id: string
}

export interface NodeRef {
  id: string
  getLocalTransform(): Mat3
  getWorldTransform(): Mat3
  getLocalBounds(): { origin: Vec2; size: Vec2 } | null
  getWorldBounds(): { origin: Vec2; size: Vec2 } | null
}

export interface CanvasPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click' | 'pointerenter' | 'pointerleave' | 'wheel'
  timestamp: number
  pointerId: number
  devicePixelRatio: number
  position: Vec2
  localPosition: Vec2
  buttons: number
  modifiers: Readonly<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }>
  target: SceneNodeHandle
  stopPropagation(): void
  preventDefault(): void
  capturePointer(pointerId: number): void
  releasePointerCapture(pointerId: number): void
  delta?: Vec2
}

export interface CanvasWheelEvent extends CanvasPointerEvent {
  delta: Vec2
}

export type CanvasDragEvent = Omit<CanvasPointerEvent, 'type' | 'delta'> & {
  type: 'dragstart' | 'dragmove' | 'dragend'
  delta: Vec2
}

export type CanvasPointerHandler = (event: CanvasPointerEvent) => void
export type CanvasWheelHandler = (event: CanvasWheelEvent) => void
export type CanvasDragHandler = (event: CanvasDragEvent) => void

export interface NodeProps {
  id?: string
  opacity?: number
  transform?: Mat3
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  offset?: Vec2
  offsetX?: number
  offsetY?: number
  visible?: boolean
  listening?: boolean
  hitSlop?: number | Vec2
  draggable?: boolean
  _useStrictMode?: boolean
  metadata?: Record<string, unknown>
  onPointerDown?: CanvasPointerHandler
  onPointerMove?: CanvasPointerHandler
  onPointerUp?: CanvasPointerHandler
  onPointerEnter?: CanvasPointerHandler
  onPointerLeave?: CanvasPointerHandler
  onClick?: CanvasPointerHandler
  onWheel?: CanvasWheelHandler
  onDragStart?: CanvasDragHandler
  onDragMove?: CanvasDragHandler
  onDragEnd?: CanvasDragHandler
}

export interface CanvasProps {
  width?: number
  height?: number
  autoSize?: boolean
  devicePixelRatio?: number
  colorSpace?: 'srgb' | 'display-p3'
  antialiasing?: 'fast' | 'msaa' | 'none'
  backgroundColor?: string | RgbaColor
  className?: string
  style?: CSSProperties
  tabIndex?: number
  role?: string
  title?: string
  ariaLabel?: string
  onReady?: (context: CanvasContext) => void
  onError?: (error: Error) => void
  children?: ReactNode
}

export interface CanvasContext {
  canvas: HTMLCanvasElement
  presentationSize: Vec2
  requestFrame(): void
  readPixels(target: Uint8Array, rect?: { origin: Vec2; size: Vec2 }): Promise<void>
  backend: 'webgpu' | 'canvas'
}

export interface GroupProps extends NodeProps {
  children?: ReactNode
  blendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
  clipPath?: string
}

export interface RectProps extends NodeProps {
  origin?: Vec2
  size?: Vec2
  width?: number
  height?: number
  radius?: number | Vec2 | readonly [Vec2, Vec2, Vec2, Vec2]
  fill?: Paint
  stroke?: Stroke
}

export interface PathProps extends NodeProps {
  d: string
  fill?: Paint
  stroke?: Stroke
  fillRule?: 'nonzero' | 'evenodd'
}

export interface TextFont {
  family: string
  size: number
  weight?: number | 'normal' | 'bold'
  style?: 'normal' | 'italic'
  lineHeight?: number
}

export interface TextProps extends NodeProps {
  text: string
  origin?: Vec2
  maxWidth?: number
  align?: 'start' | 'center' | 'end'
  font: TextFont
  fill?: Paint
}

export interface ImageProps extends NodeProps {
  source: string | ImageBitmap | HTMLImageElement
  origin?: Vec2
  size?: Vec2
  width?: number
  height?: number
  colorSpace?: 'srgb' | 'display-p3'
  opacityMap?: string
  fit?: 'cover' | 'contain' | 'stretch'
}

export interface LinearGradientProps extends NodeProps {
  id: string
  from: Vec2
  to: Vec2
  stops: readonly { offset: number; color: string | RgbaColor }[]
}

export interface RadialGradientProps extends NodeProps {
  id: string
  center: Vec2
  radius: number
  stops: readonly { offset: number; color: string | RgbaColor }[]
}

export interface MaskProps extends NodeProps {
  id: string
  children?: ReactNode
}

export interface ClipPathProps extends NodeProps {
  id: string
  children?: ReactNode
}

export interface CanvasIntrinsicElements {
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

declare global {
  namespace JSX {
    interface IntrinsicElements extends CanvasIntrinsicElements {}
  }
}

export type CanvasEvent = CanvasPointerEvent | CanvasDragEvent
