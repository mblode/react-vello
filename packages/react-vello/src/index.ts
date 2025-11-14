import type { ReactNode } from 'react'
import Reconciler from 'react-reconciler'
import type { CanvasContext } from '@react-vello/types'
import {
  type CanvasContainer,
  type HostProps,
  type HostType,
  type SceneNode,
  createCanvasContainer,
  sanitizeProps,
  scheduleRender,
  setRootNode,
} from './runtime'
import { createWasmRenderer, type WasmRenderer } from './wasmBridge'
export * from './components'

const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

interface WasmDriverOptions {
  onFailure?: () => void
}

class WasmDriver {
  private renderer: WasmRenderer | null = null
  private pending: Uint8Array | null = null
  private readonly onFailure?: () => void

  constructor(canvas: HTMLCanvasElement, options: WasmDriverOptions = {}) {
    this.onFailure = options.onFailure

    createWasmRenderer(canvas)
      .then((renderer) => {
        if (!renderer) {
          this.handleFailure()
          return
        }
        this.renderer = renderer
        if (this.pending) {
          this.renderer.apply(this.pending)
          this.renderer.render()
          this.pending = null
        }
      })
      .catch((error) => {
        console.warn('[rvello] wasm renderer unavailable', error)
        this.handleFailure()
      })
  }

  private handleFailure() {
    this.renderer = null
    this.pending = null
    this.onFailure?.()
  }

  enqueue(ops: Uint8Array) {
    if (!this.renderer) {
      this.pending = ops.slice()
      return
    }

    const copy = ops.slice()
    try {
      this.renderer.apply(copy)
      this.renderer.render()
    } catch (error) {
      console.error('[rvello] wasm render failed', error)
      this.handleFailure()
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
    return {
      type,
      props: sanitizeProps(props),
      children: [],
    }
  },
  createTextInstance(text: string) {
    console.warn('[rvello] Text nodes are not supported; wrap strings in <Text>.')
    return text
  },
  appendInitialChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    parent.children.push(child)
  },
  appendChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    parent.children.push(child)
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
    }
  },
  removeChildFromContainer(container: CanvasContainer, child: Instance | TextInstance) {
    if (typeof child === 'string') return
    if (container.root === child) {
      setRootNode(container, null)
    }
  },
  finalizeInitialChildren() {
    return false
  },
  prepareUpdate(): UpdatePayload {
    return true
  },
  commitUpdate(instance: Instance, _payload: UpdatePayload, _type: HostType, _oldProps: HostProps, newProps: HostProps) {
    instance.props = sanitizeProps(newProps)
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
    container.root = null
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
}

export interface VelloRoot {
  render(children: ReactNode): void
  unmount(): void
  getContext(): CanvasContext
}

export function createVelloRoot(canvas: HTMLCanvasElement, options: RendererOptions = {}): VelloRoot {
  const useWebGPU = supportsWebGPU
  let wasmDriver: WasmDriver | null = null
  const container = createCanvasContainer(canvas, {
    onFrame(ops) {
      options.onFrame?.(ops)
      wasmDriver?.enqueue(ops)
    },
    softwareRenderer: !useWebGPU,
  })

  if (useWebGPU) {
    wasmDriver = new WasmDriver(canvas, {
      onFailure: () => {
        container.enableSoftwareRenderer()
        scheduleRender(container)
      },
    })
  }

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
  }

  if (options.onReady) {
    options.onReady(context)
  }

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
