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

type Instance = SceneNode
type TextInstance = string
type HydratableInstance = never
type PublicInstance = SceneNode
type HostContext = null
type UpdatePayload = true
type ChildSet = never
type TimeoutHandle = number
type NoTimeout = number

const NoTimeoutValue: NoTimeout = -1

const hostConfig: Reconciler.HostConfig<
  HostType,
  HostProps,
  CanvasContainer,
  Instance,
  TextInstance,
  HydratableInstance,
  PublicInstance,
  HostContext,
  HostContext,
  ChildSet,
  ChildSet,
  UpdatePayload,
  ChildSet,
  TimeoutHandle,
  NoTimeout
> = {
  now: Date.now,
  getRootHostContext() {
    return null
  },
  getChildHostContext() {
    return null
  },
  getPublicInstance(instance) {
    return instance
  },
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  shouldSetTextContent() {
    return false
  },
  createInstance(type, props) {
    return {
      type,
      props: sanitizeProps(props),
      children: [],
    }
  },
  createTextInstance(text) {
    console.warn('[rvello] Text nodes are not supported; wrap strings in <Text>.')
    return text
  },
  appendInitialChild(parent, child) {
    parent.children.push(child)
  },
  appendChild(parent, child) {
    parent.children.push(child)
  },
  appendChildToContainer(container, child) {
    setRootNode(container, child)
  },
  insertBefore(parent, child, beforeChild) {
    const index = parent.children.indexOf(beforeChild)
    if (index === -1) {
      parent.children.push(child)
    } else {
      parent.children.splice(index, 0, child)
    }
  },
  insertInContainerBefore(container, child) {
    setRootNode(container, child)
  },
  removeChild(parent, child) {
    const index = parent.children.indexOf(child)
    if (index >= 0) {
      parent.children.splice(index, 1)
    }
  },
  removeChildFromContainer(container, child) {
    if (container.root === child) {
      setRootNode(container, null)
    }
  },
  finalizeInitialChildren() {
    return false
  },
  prepareUpdate() {
    return true
  },
  commitUpdate(instance, payload, type, oldProps, newProps) {
    instance.props = sanitizeProps(newProps)
  },
  commitTextUpdate() {
    // no-op
  },
  prepareForCommit() {
    return null
  },
  resetAfterCommit(container) {
    scheduleRender(container)
  },
  clearContainer(container) {
    container.root = null
    const { context, canvas } = container
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()
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
  scheduleMicrotask(task) {
    queueMicrotask(task)
  },
  supportsMicrotasks: true,
  isPrimaryRenderer: true,
}

const reconciler = Reconciler(hostConfig)

export interface RendererOptions {
  onReady?: (context: CanvasContext) => void
}

export interface VelloRoot {
  render(children: ReactNode): void
  unmount(): void
  getContext(): CanvasContext
}

export function createVelloRoot(canvas: HTMLCanvasElement, options: RendererOptions = {}): VelloRoot {
  const container = createCanvasContainer(canvas)
  const reconRoot = reconciler.createContainer(
    container,
    0,
    null,
    false,
    null,
    false,
    '',
    (error) => {
      console.error('[rvello] recoverable error', error)
    },
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
