import type { ReactNode } from 'react'
import Reconciler from 'react-reconciler'
import type { CanvasContext } from '@react-vello/types'
import {
  type CanvasContainer,
  type HostProps,
  type HostType,
  type SceneNode,
  createCanvasContainer,
  createSceneNode,
  setStrictMode,
  sanitizeProps,
  scheduleRender,
  setRootNode,
} from './runtime'
import { createWasmRenderer, type WasmRenderer } from './wasmBridge'
export * from './components'

const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

interface WasmDriverOptions {
  onReady?: () => void
  onError?: (error: unknown) => void
}

class WasmDriver {
  private renderer: WasmRenderer | null = null
  private pending: Uint8Array | null = null
  private readonly onReady?: () => void
  private readonly onError?: (error: unknown) => void

  constructor(canvas: HTMLCanvasElement, options: WasmDriverOptions = {}) {
    this.onReady = options.onReady
    this.onError = options.onError

    createWasmRenderer(canvas)
      .then((renderer) => {
        if (!renderer) {
          this.handleFailure(new Error('WebGPU renderer unavailable.'))
          return
        }
        this.renderer = renderer
        this.onReady?.()
        if (this.pending) {
          this.renderer.apply(this.pending)
          this.renderer.render()
          this.pending = null
        }
      })
      .catch((error) => {
        console.error('[rvello] wasm renderer unavailable', error)
        this.handleFailure(error)
      })
  }

  private handleFailure(error: unknown) {
    this.renderer = null
    this.pending = null
    this.onError?.(error)
  }

  enqueue(ops: Uint8Array) {
    if (!this.renderer) {
      this.pending = ops
      return
    }

    try {
      this.renderer.apply(ops)
      this.renderer.render()
    } catch (error) {
      console.error('[rvello] wasm render failed', error)
      this.handleFailure(error)
    }
  }
}

type Instance = SceneNode
type TextInstance = string
type SuspenseInstance = never
type HydratableInstance = never
type PublicInstance = SceneNode
type HostContext = null
type UpdatePayload = true
type ChildSet = never
type TimeoutHandle = number
type NoTimeout = number

const NoTimeoutValue: NoTimeout = -1

const layoutPropKeys = [
  'transform',
  'x',
  'y',
  'rotation',
  'scaleX',
  'scaleY',
  'offset',
  'offsetX',
  'offsetY',
  'origin',
  'size',
  'width',
  'height',
] as const

function didLayoutPropsChange(prevProps: HostProps, nextProps: HostProps): boolean {
  for (const key of layoutPropKeys) {
    const prevHas = Object.prototype.hasOwnProperty.call(prevProps, key)
    const nextHas = Object.prototype.hasOwnProperty.call(nextProps, key)
    if (!prevHas && !nextHas) {
      continue
    }
    const prevValue = (prevProps as Record<string, unknown>)[key]
    const nextValue = (nextProps as Record<string, unknown>)[key]
    if (!Object.is(prevValue, nextValue)) {
      return true
    }
  }
  return false
}

const hostConfig = {
  getRootHostContext(): HostContext {
    return null
  },
  getChildHostContext(): HostContext {
    return null
  },
  getPublicInstance(instance: Instance): PublicInstance {
    return instance
  },
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  shouldSetTextContent() {
    return false
  },
  createInstance(type: HostType, props: HostProps): Instance {
    return createSceneNode(type, sanitizeProps(props))
  },
  createTextInstance(text: string) {
    console.warn('[rvello] Text nodes are not supported; wrap strings in <Text>.')
    return text
  },
  appendInitialChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    parent.children.push(child)
    child.parent = parent
  },
  appendChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    parent.children.push(child)
    child.parent = parent
  },
  appendChildToContainer(container: CanvasContainer, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    setRootNode(container, child)
  },
  insertBefore(parent: Instance, child: Instance | TextInstance, beforeChild: Instance | TextInstance) {
    if (typeof child === 'string' || typeof beforeChild === 'string') return
    const index = parent.children.indexOf(beforeChild)
    if (index === -1) {
      parent.children.push(child)
    } else {
      parent.children.splice(index, 0, child)
    }
    child.parent = parent
  },
  insertInContainerBefore(container: CanvasContainer, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    setRootNode(container, child)
  },
  removeChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    const index = parent.children.indexOf(child)
    if (index >= 0) {
      parent.children.splice(index, 1)
      child.parent = null
    }
  },
  removeChildFromContainer(container: CanvasContainer, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    if (container.root === child) {
      setRootNode(container, null)
      child.parent = null
    }
  },
  finalizeInitialChildren() {
    return false
  },
  prepareUpdate(): UpdatePayload {
    return true
  },
  commitUpdate(instance: Instance, _payload: UpdatePayload, _type: HostType, _oldProps: HostProps, newProps: HostProps) {
    const nextProps = sanitizeProps(newProps)
    const prevProps = instance.props
    instance.props = nextProps
    if (
      instance.draggingPointerId === null &&
      (instance.dragOffset[0] !== 0 || instance.dragOffset[1] !== 0) &&
      didLayoutPropsChange(prevProps, nextProps)
    ) {
      instance.dragOffset = [0, 0]
    }
  },
  commitTextUpdate() {
    // no-op
  },
  prepareForCommit() {
    return null
  },
  resetAfterCommit(container: CanvasContainer) {
    scheduleRender(container)
  },
  clearContainer(container: CanvasContainer) {
    if (container.root) {
      container.root.parent = null
    }
    container.root = null
    container.hitRegions = []
    container.hitRegionMap.clear()
    container.pointerCaptures.clear()
    container.hoverStates.clear()
    container.dragSessions.clear()
    const { context, canvas } = container
    if (context) {
      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.restore()
    }
  },
  detachDeletedInstance() {
    // no-op
  },
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: NoTimeoutValue,
  preparePortalMount() {
    // no-op
  },
  beforeActiveInstanceBlur() {
    // no-op
  },
  afterActiveInstanceBlur() {
    // no-op
  },
  scheduleMicrotask(task: () => void) {
    queueMicrotask(task)
  },
  supportsMicrotasks: true,
  isPrimaryRenderer: true,
} as unknown as Reconciler.HostConfig<
  HostType,
  HostProps,
  CanvasContainer,
  Instance,
  TextInstance,
  SuspenseInstance,
  HydratableInstance,
  PublicInstance,
  HostContext,
  UpdatePayload,
  ChildSet,
  TimeoutHandle,
  NoTimeout
>

const reconciler = Reconciler(hostConfig)

export interface RendererOptions {
  onReady?: (context: CanvasContext) => void
  onFrame?: (ops: Uint8Array) => void
  onError?: (error: unknown) => void
}

export interface VelloRoot {
  render(children: ReactNode): void
  unmount(): void
  getContext(): CanvasContext
}

export function createVelloRoot(canvas: HTMLCanvasElement, options: RendererOptions = {}): VelloRoot {
  if (!supportsWebGPU) {
    throw new Error('[rvello] WebGPU is required to create a Vello root.')
  }

  let wasmDriver: WasmDriver | null = null
  const container = createCanvasContainer(canvas, {
    onFrame(ops) {
      options.onFrame?.(ops)
      wasmDriver?.enqueue(ops)
    },
    softwareRenderer: false,
  })

  const reconRoot = reconciler.createContainer(
    container,
    0,
    null,
    false,
    null,
    '',
    (error) => {
      console.error('[rvello] recoverable error', error)
    },
    null,
  )

  const context: CanvasContext = {
    canvas,
    presentationSize: container.presentationSize as unknown as readonly [number, number],
    requestFrame: () => scheduleRender(container),
    async readPixels() {
      throw new Error('readPixels is not implemented in the preview renderer')
    },
    backend: 'webgpu',
  }

  wasmDriver = new WasmDriver(canvas, {
    onReady: () => {
      options.onReady?.(context)
    },
    onError: (error) => {
      wasmDriver = null
      options.onError?.(error)
    },
  })

  return {
    render(children) {
      reconciler.updateContainer(children, reconRoot, null, () => undefined)
    },
    unmount() {
      reconciler.updateContainer(null, reconRoot, null, () => undefined)
    },
    getContext() {
      return context
    },
  }
}

export function useStrictMode(value: boolean): void {
  setStrictMode(value)
}
