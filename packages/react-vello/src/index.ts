import { createContext, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import {
  DefaultEventPriority,
  LegacyRoot,
  NoEventPriority,
} from "react-reconciler/constants";
import {
  type CanvasContainer,
  createCanvasContainer,
  createSceneNode,
  type HostProps,
  type HostType,
  type SceneNode,
  sanitizeProps,
  scheduleRender,
  setRootNode,
  setStrictMode,
} from "./runtime";
import type { CanvasContext } from "./types";
import { createWasmRenderer, type WasmRenderer } from "./wasmBridge";

// biome-ignore lint/performance/noBarrelFile: public entrypoint exports
export * from "./components";
export * from "./types";

const supportsWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;

interface WasmDriverOptions {
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

class WasmDriver {
  private renderer: WasmRenderer | null = null;
  private pending: Uint8Array | null = null;
  private readonly onReady?: () => void;
  private readonly onError?: (error: unknown) => void;

  constructor(canvas: HTMLCanvasElement, options: WasmDriverOptions = {}) {
    this.onReady = options.onReady;
    this.onError = options.onError;

    createWasmRenderer(canvas)
      .then((renderer) => {
        if (!renderer) {
          this.handleFailure(new Error("WebGPU renderer unavailable."));
          return;
        }
        this.renderer = renderer;
        this.onReady?.();
        if (this.pending) {
          this.renderer.apply(this.pending);
          this.renderer.render();
          this.pending = null;
        }
      })
      .catch((error) => {
        console.error("[rvello] wasm renderer unavailable", error);
        this.handleFailure(error);
      });
  }

  private handleFailure(error: unknown) {
    this.renderer = null;
    this.pending = null;
    this.onError?.(error);
  }

  enqueue(ops: Uint8Array) {
    if (!this.renderer) {
      this.pending = ops;
      return;
    }

    try {
      this.renderer.apply(ops);
      this.renderer.render();
    } catch (error) {
      console.error("[rvello] wasm render failed", error);
      this.handleFailure(error);
    }
  }
}

type Instance = SceneNode;
type TextInstance = string;
type SuspenseInstance = never;
type HydratableInstance = never;
type FormInstance = never;
type PublicInstance = SceneNode;
type HostContext = null;
type ChildSet = never;
type TimeoutHandle = number;
type NoTimeout = number;
type TransitionStatus = null;

const NoTimeoutValue: NoTimeout = -1;
const NotPendingTransition: TransitionStatus = null;
const HostTransitionContext =
  createContext<TransitionStatus>(NotPendingTransition);
let currentUpdatePriority = NoEventPriority;

const layoutPropKeys = [
  "transform",
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "offset",
  "offsetX",
  "offsetY",
  "origin",
  "size",
  "width",
  "height",
] as const;

function hasTextChildren(children: unknown): boolean {
  if (
    children === null ||
    children === undefined ||
    typeof children === "boolean"
  ) {
    return false;
  }
  if (typeof children === "string" || typeof children === "number") {
    return true;
  }
  if (Array.isArray(children)) {
    return children.some(hasTextChildren);
  }
  return false;
}

function didLayoutPropsChange(
  prevProps: HostProps,
  nextProps: HostProps
): boolean {
  for (const key of layoutPropKeys) {
    const prevHas = Object.hasOwn(prevProps, key);
    const nextHas = Object.hasOwn(nextProps, key);
    if (!(prevHas || nextHas)) {
      continue;
    }
    const prevValue = (prevProps as Record<string, unknown>)[key];
    const nextValue = (nextProps as Record<string, unknown>)[key];
    if (!Object.is(prevValue, nextValue)) {
      return true;
    }
  }
  return false;
}

const hostConfig = {
  getRootHostContext(_rootContainer: CanvasContainer): HostContext {
    return null;
  },
  getChildHostContext(
    _parentHostContext: HostContext,
    _type: HostType,
    _rootContainer: CanvasContainer
  ): HostContext {
    return null;
  },
  getPublicInstance(instance: Instance | TextInstance): PublicInstance {
    return instance as PublicInstance;
  },
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  shouldSetTextContent(
    type: HostType,
    props: HostProps & { children?: unknown }
  ) {
    if (type !== "Text") {
      return false;
    }
    return hasTextChildren(props.children);
  },
  createInstance(
    type: HostType,
    props: HostProps,
    _rootContainer: CanvasContainer,
    _hostContext: HostContext,
    _internalHandle: unknown
  ): Instance {
    return createSceneNode(type, sanitizeProps(type, props));
  },
  createTextInstance(
    text: string,
    _rootContainer: CanvasContainer,
    _hostContext: HostContext,
    _internalHandle: unknown
  ) {
    console.warn(
      "[rvello] Text nodes are not supported; wrap strings in <Text>."
    );
    return text;
  },
  appendInitialChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === "string") {
      return;
    }
    parent.children.push(child);
    child.parent = parent;
  },
  appendChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === "string") {
      return;
    }
    parent.children.push(child);
    child.parent = parent;
  },
  appendChildToContainer(
    container: CanvasContainer,
    child: Instance | TextInstance
  ) {
    if (typeof child === "string") {
      return;
    }
    setRootNode(container, child);
  },
  insertBefore(
    parent: Instance,
    child: Instance | TextInstance,
    beforeChild: Instance | TextInstance
  ) {
    if (typeof child === "string" || typeof beforeChild === "string") {
      return;
    }
    const index = parent.children.indexOf(beforeChild);
    if (index === -1) {
      parent.children.push(child);
    } else {
      parent.children.splice(index, 0, child);
    }
    child.parent = parent;
  },
  insertInContainerBefore(
    container: CanvasContainer,
    child: Instance | TextInstance,
    _beforeChild: Instance | TextInstance
  ) {
    if (typeof child === "string") {
      return;
    }
    setRootNode(container, child);
  },
  removeChild(parent: Instance, child: Instance | TextInstance) {
    if (typeof child === "string") {
      return;
    }
    const index = parent.children.indexOf(child);
    if (index >= 0) {
      parent.children.splice(index, 1);
      child.parent = null;
    }
  },
  removeChildFromContainer(
    container: CanvasContainer,
    child: Instance | TextInstance
  ) {
    if (typeof child === "string") {
      return;
    }
    if (container.root === child) {
      setRootNode(container, null);
      child.parent = null;
    }
  },
  finalizeInitialChildren() {
    return false;
  },
  commitUpdate(
    instance: Instance,
    type: HostType,
    _oldProps: HostProps,
    newProps: HostProps,
    _internalHandle: unknown
  ) {
    const nextProps = sanitizeProps(type, newProps);
    const prevProps = instance.props;
    instance.props = nextProps;
    if (
      instance.draggingPointerId === null &&
      (instance.dragOffset[0] !== 0 || instance.dragOffset[1] !== 0) &&
      didLayoutPropsChange(prevProps, nextProps)
    ) {
      instance.dragOffset = [0, 0];
    }
  },
  commitTextUpdate(
    _textInstance: TextInstance,
    _oldText: string,
    _newText: string
  ) {
    // no-op
  },
  prepareForCommit(_container: CanvasContainer) {
    return null;
  },
  resetAfterCommit(container: CanvasContainer) {
    scheduleRender(container);
  },
  clearContainer(container: CanvasContainer) {
    if (container.root) {
      container.root.parent = null;
    }
    container.root = null;
    container.hitRegions = [];
    container.hitRegionMap.clear();
    container.pointerCaptures.clear();
    container.hoverStates.clear();
    container.dragSessions.clear();
    const { context, canvas } = container;
    if (context) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }
  },
  detachDeletedInstance(_node: Instance) {
    // no-op
  },
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: NoTimeoutValue,
  preparePortalMount() {
    // no-op
  },
  getInstanceFromNode(_node: unknown) {
    return null;
  },
  beforeActiveInstanceBlur() {
    // no-op
  },
  afterActiveInstanceBlur() {
    // no-op
  },
  prepareScopeUpdate(_scopeInstance: unknown, _instance: Instance) {
    // no-op
  },
  getInstanceFromScope(_scopeInstance: unknown) {
    return null;
  },
  setCurrentUpdatePriority(newPriority: number) {
    currentUpdatePriority = newPriority;
  },
  getCurrentUpdatePriority() {
    return currentUpdatePriority;
  },
  resolveUpdatePriority() {
    return currentUpdatePriority !== NoEventPriority
      ? currentUpdatePriority
      : DefaultEventPriority;
  },
  requestPostPaintCallback(callback: (time: number) => void) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame((time) => callback(time));
      return;
    }
    setTimeout(() => callback(Date.now()), 0);
  },
  shouldAttemptEagerTransition() {
    return false;
  },
  trackSchedulerEvent() {
    // no-op
  },
  resolveEventType() {
    if (typeof window === "undefined") {
      return null;
    }
    return window.event ? window.event.type : null;
  },
  resolveEventTimeStamp() {
    if (typeof window === "undefined") {
      return -1.1;
    }
    const event = window.event;
    return event && typeof event.timeStamp === "number"
      ? event.timeStamp
      : -1.1;
  },
  NotPendingTransition,
  HostTransitionContext,
  resetFormInstance(_form: FormInstance) {
    // no-op
  },
  maySuspendCommit(_type: HostType, _props: HostProps) {
    return false;
  },
  maySuspendCommitOnUpdate(
    _type: HostType,
    _oldProps: HostProps,
    _newProps: HostProps
  ) {
    return false;
  },
  maySuspendCommitInSyncRender(_type: HostType, _props: HostProps) {
    return false;
  },
  preloadInstance(_instance: Instance, _type: HostType, _props: HostProps) {
    return false;
  },
  startSuspendingCommit() {
    return null;
  },
  suspendInstance(
    _suspendedState: unknown,
    _instance: Instance,
    _type: HostType,
    _props: HostProps
  ) {
    // no-op
  },
  waitForCommitToBeReady(_suspendedState: unknown, _timeout: number) {
    return null;
  },
  getSuspendedCommitReason() {
    return null;
  },
  scheduleMicrotask(task: () => void) {
    queueMicrotask(task);
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
  FormInstance,
  PublicInstance,
  HostContext,
  ChildSet,
  TimeoutHandle,
  NoTimeout,
  TransitionStatus
>;

const reconciler = Reconciler(hostConfig);

export interface RendererOptions {
  onReady?: (context: CanvasContext) => void;
  onFrame?: (ops: Uint8Array) => void;
  onError?: (error: unknown) => void;
}

export interface VelloRoot {
  render(children: ReactNode): void;
  unmount(): void;
  getContext(): CanvasContext;
}

export function createVelloRoot(
  canvas: HTMLCanvasElement,
  options: RendererOptions = {}
): VelloRoot {
  if (!supportsWebGPU) {
    throw new Error("[rvello] WebGPU is required to create a Vello root.");
  }

  let wasmDriver: WasmDriver | null = null;
  const container = createCanvasContainer(canvas, {
    onFrame(ops) {
      options.onFrame?.(ops);
      wasmDriver?.enqueue(ops);
    },
    softwareRenderer: false,
  });

  const reconRoot = reconciler.createContainer(
    container,
    LegacyRoot,
    null,
    false,
    null,
    "",
    (error, info) => {
      console.error("[rvello] uncaught error", error, info);
    },
    (error, info) => {
      console.error("[rvello] caught error", error, info);
    },
    (error, info) => {
      console.error("[rvello] recoverable error", error, info);
    },
    () => undefined,
    null
  );

  const context: CanvasContext = {
    canvas,
    presentationSize: container.presentationSize as unknown as readonly [
      number,
      number,
    ],
    requestFrame: () => scheduleRender(container),
    readPixels() {
      return Promise.reject(
        new Error("readPixels is not implemented in the preview renderer")
      );
    },
    backend: "webgpu",
  };

  wasmDriver = new WasmDriver(canvas, {
    onReady: () => {
      options.onReady?.(context);
    },
    onError: (error) => {
      wasmDriver = null;
      options.onError?.(error);
    },
  });

  return {
    render(children) {
      reconciler.updateContainer(children, reconRoot, null, () => undefined);
    },
    unmount() {
      reconciler.updateContainer(null, reconRoot, null, () => undefined);
    },
    getContext() {
      return context;
    },
  };
}

export function useStrictMode(value: boolean): void {
  setStrictMode(value);
}
