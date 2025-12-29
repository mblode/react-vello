import "./style.css";
import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import type Konva from "konva";
import { Circle, Layer, Stage } from "react-konva";
import {
  Canvas,
  Group,
  Path,
  Rect,
  createVelloRoot,
  type CanvasContext,
  type NodeRef,
  type RectProps,
  type VelloRoot,
  type CanvasPointerEvent,
} from "react-vello";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type SupportStatus =
  | { ok: true }
  | { ok: false; reason: string; hint?: string };

type Point = {
  x: number;
  y: number;
};

type HandleId = "start" | "control1" | "control2" | "end";

type HandleMap = Record<HandleId, Point>;

const HANDLE_ORDER: HandleId[] = ["start", "control1", "control2", "end"];
const STRESS_TEST_REACT_VELLO_PATH = "/stress-test-react-vello";
const STRESS_TEST_REACT_DOM_PATH = "/stress-test-react-dom";
const STRESS_TEST_REACT_KONVA_PATH = "/stress-test-react-konva";
const PARTICLE_COUNT_MIN = 1000;
const PARTICLE_COUNT_MAX = 30000;
const PARTICLE_COUNT_STEP = 500;
const PARTICLE_COUNT_DEFAULT = 8000;
const PARTICLE_PALETTE = ["#38bdf8", "#f472b6", "#facc15", "#a7f3d0", "#c4b5fd"];
const STRESS_BG = "#05070d";

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  twinkle: number;
  color: string;
  opacity: number;
};

async function detectWebGPU(): Promise<SupportStatus> {
  if (!("gpu" in navigator)) {
    return {
      ok: false,
      reason: "This browser does not expose navigator.gpu.",
      hint: "Use Chrome 125+ or Edge 125+ with WebGPU enabled in chrome://flags.",
    };
  }

  let adapter: GPUAdapter | null = null;
  try {
    adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
  } catch {
    return {
      ok: false,
      reason: "Failed to request a WebGPU adapter.",
      hint: "Confirm WebGPU is enabled and hardware acceleration is available.",
    };
  }
  if (!adapter) {
    return {
      ok: false,
      reason: "No compatible GPU adapter found.",
      hint: "Ensure that chrome://flags/#enable-unsafe-webgpu is enabled.",
    };
  }

  const enrichedAdapter = adapter as GPUAdapter & {
    name?: string;
    isFallbackAdapter?: boolean;
  };

  if (enrichedAdapter.isFallbackAdapter) {
    return {
      ok: false,
      reason: "WebGPU fallback adapter detected.",
      hint: "Run with a non-fallback adapter to enable Vello.",
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = (document.createElement("canvas").getContext as any)("webgpu");
    if (!context) {
      return {
        ok: false,
        reason: "WebGPU context unavailable.",
        hint: "Enable WebGPU and restart the browser.",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "Failed to create a WebGPU context.",
      hint: "Confirm WebGPU is enabled and restart the browser.",
    };
  }

  return {
    ok: true,
  };
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleChange = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handleChange);
    return () => window.removeEventListener("popstate", handleChange);
  }, []);

  return pathname;
}

function navigate(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function buildCubicPath(start: Point, c1: Point, c2: Point, end: Point): string {
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function getCubicPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const a = { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
  const b = { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) };
  const c = { x: lerp(p2.x, p3.x, t), y: lerp(p2.y, p3.y, t) };
  const d = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  const e = { x: lerp(b.x, c.x, t), y: lerp(b.y, c.y, t) };
  return { x: lerp(d.x, e.x, t), y: lerp(d.y, e.y, t) };
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const velloRootRef = useRef<VelloRoot | null>(null);

  const [status, setStatus] = useState<SupportStatus | null>(null);

  const size = useViewportSize();
  const pathname = usePathname();
  const normalizedPath = pathname !== "/" && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const isReactVelloTest = normalizedPath === STRESS_TEST_REACT_VELLO_PATH;
  const isReactDomTest = normalizedPath === STRESS_TEST_REACT_DOM_PATH;
  const isReactKonvaTest = normalizedPath === STRESS_TEST_REACT_KONVA_PATH;
  const isDemo = !isReactVelloTest && !isReactDomTest && !isReactKonvaTest;
  const isVelloPage = isDemo || isReactVelloTest;

  const [particleCount, setParticleCount] = useState(PARTICLE_COUNT_DEFAULT);
  const [velloFps, setVelloFps] = useState(0);
  const [reactDomFps, setReactDomFps] = useState(0);
  const [reactKonvaFps, setReactKonvaFps] = useState(0);

  useEffect(() => {
    let active = true;
    detectWebGPU().then((result) => {
      if (!active) return;
      setStatus(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!status?.ok || !canvas || !isVelloPage) {
      velloRootRef.current?.unmount();
      velloRootRef.current = null;
      return;
    }

    const root = createVelloRoot(canvas, {
      onError: (error: unknown) => {
        console.error("[rvello] WebGPU renderer error", error);
      },
    });

    velloRootRef.current = root;

    return () => {
      root.unmount();
      if (velloRootRef.current === root) {
        velloRootRef.current = null;
      }
    };
  }, [status?.ok, isVelloPage]);

  useEffect(() => {
    const root = velloRootRef.current;
    if (!root || !status?.ok || size.width === 0 || size.height === 0) return;
    if (!isVelloPage) return;
    if (isReactVelloTest) {
      const context = root.getContext();
      root.render(
        <ReactVelloStressTest
          width={size.width}
          height={size.height}
          particleCount={particleCount}
          onFps={setVelloFps}
          context={context}
        />,
      );
      return;
    }
    root.render(<DemoScene width={size.width} height={size.height} />);
  }, [
    status?.ok,
    size.width,
    size.height,
    isReactVelloTest,
    isVelloPage,
    particleCount,
  ]);

  const handleParticleCountChange = (value: number) => {
    setParticleCount(clamp(value, PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX));
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isVelloPage ? "block" : "hidden"}`}
        aria-label="WebGPU canvas demo"
      ></canvas>
      {isReactDomTest ? (
        <ReactDomStressTest
          width={size.width}
          height={size.height}
          particleCount={particleCount}
          onFps={setReactDomFps}
        />
      ) : null}
      {isReactKonvaTest ? (
        <ReactKonvaStressTest
          width={size.width}
          height={size.height}
          particleCount={particleCount}
          onFps={setReactKonvaFps}
        />
      ) : null}
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold tracking-wide text-foreground/90">
          React Vello Demo
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppLink to="/" isActive={isDemo}>
            Demo
          </AppLink>
          <AppLink to={STRESS_TEST_REACT_VELLO_PATH} isActive={isReactVelloTest}>
            React Vello
          </AppLink>
          <AppLink to={STRESS_TEST_REACT_KONVA_PATH} isActive={isReactKonvaTest}>
            React Konva
          </AppLink>
          <AppLink to={STRESS_TEST_REACT_DOM_PATH} isActive={isReactDomTest}>
            React DOM
          </AppLink>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="pointer-events-auto"
          >
            <a
              href="https://github.com/mblode/react-vello"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </Button>
        </div>
      </div>
      {isReactVelloTest ? (
        <ParticleStressHud
          title="React Vello"
          subtitle="WebGPU Scene Graph"
          description="Same particle simulation, Vello renderer."
          countLabel="Particles"
          count={particleCount}
          fps={velloFps}
          onCountChange={handleParticleCountChange}
        />
      ) : null}
      {isReactKonvaTest ? (
        <ParticleStressHud
          title="React Konva"
          subtitle="Canvas 2D Scene"
          description="Same particle simulation, Konva nodes."
          countLabel="Particles"
          count={particleCount}
          fps={reactKonvaFps}
          onCountChange={handleParticleCountChange}
        />
      ) : null}
      {isReactDomTest ? (
        <ParticleStressHud
          title="React DOM"
          subtitle="DOM Particle Field"
          description="Same particle simulation, DOM nodes."
          countLabel="Particles"
          count={particleCount}
          fps={reactDomFps}
          onCountChange={handleParticleCountChange}
        />
      ) : null}
    </div>
  );
}

type AppLinkProps = {
  to: string;
  isActive?: boolean;
  children: ReactNode;
};

function AppLink({ to, isActive, children }: AppLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <Button
      asChild
      size="sm"
      variant={isActive ? "secondary" : "ghost"}
      className="pointer-events-auto"
    >
      <a href={to} onClick={handleClick} aria-current={isActive ? "page" : undefined}>
        {children}
      </a>
    </Button>
  );
}

type ParticleStressHudProps = {
  title: string;
  subtitle: string;
  description: string;
  countLabel: string;
  count: number;
  fps: number;
  onCountChange: (value: number) => void;
};

function ParticleStressHud({
  title,
  subtitle,
  description,
  countLabel,
  count,
  fps,
  onCountChange,
}: ParticleStressHudProps) {
  const formattedCount = count.toLocaleString();
  const fpsLabel = fps > 0 ? fps.toString() : "--";

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[min(380px,92vw)] rounded-xl border border-border/60 bg-card/90 p-4 text-sm text-foreground shadow-xl backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold">{subtitle}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      <div className="mt-4 rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{countLabel}</span>
          <span className="text-sm font-semibold text-foreground">
            {formattedCount}
          </span>
        </div>
        <Slider
          value={[count]}
          min={PARTICLE_COUNT_MIN}
          max={PARTICLE_COUNT_MAX}
          step={PARTICLE_COUNT_STEP}
          onValueChange={(value) => {
            if (typeof value[0] === "number") {
              onCountChange(value[0]);
            }
          }}
          aria-label="Particle count"
          className="mt-2"
        />
        <div className="mt-2 text-[11px] text-muted-foreground">
          More particles push fill-rate and blending.
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            FPS
          </div>
          <div className="mt-1 text-lg font-semibold">{fpsLabel}</div>
          <div className="text-[10px] text-muted-foreground">avg</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {countLabel}
          </div>
          <div className="mt-1 text-lg font-semibold">{formattedCount}</div>
          <div className="text-[10px] text-muted-foreground">active</div>
        </div>
      </div>
    </div>
  );
}

type ParticleFrame = {
  particles: Particle[];
  timeSeconds: number;
  width: number;
  height: number;
};

type ParticleSimulationOptions = {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
  onFrame?: (frame: ParticleFrame) => void;
};

type MutableRectNode = NodeRef & {
  props: RectProps;
};

function getParticlePulse(timeSeconds: number, twinkle: number): number {
  return 0.6 + 0.4 * Math.sin(timeSeconds * 2 + twinkle);
}

function useParticleSimulation({
  width,
  height,
  particleCount,
  onFps,
  onFrame,
}: ParticleSimulationOptions) {
  const particlesRef = useRef<Particle[]>([]);
  const boundsRef = useRef({ width, height });
  const onFpsRef = useRef(onFps);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFpsRef.current = onFps;
  }, [onFps]);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    const previous = boundsRef.current;
    if (previous.width > 0 && previous.height > 0) {
      const scaleX = width / previous.width;
      const scaleY = height / previous.height;
      if (Number.isFinite(scaleX) && Number.isFinite(scaleY)) {
        for (const particle of particlesRef.current) {
          particle.x *= scaleX;
          particle.y *= scaleY;
        }
      }
    }
    boundsRef.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    if (width === 0 || height === 0) return;
    const particles = particlesRef.current;
    if (particles.length < particleCount) {
      for (let i = particles.length; i < particleCount; i += 1) {
        particles.push(createParticle(width, height, i));
      }
    } else if (particles.length > particleCount) {
      particles.length = particleCount;
    }
  }, [particleCount, width, height]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastFps = last;
    let frames = 0;

    const loop = (time: number) => {
      const delta = Math.min(0.05, (time - last) / 1000);
      last = time;
      const { width: currentWidth, height: currentHeight } = boundsRef.current;
      if (currentWidth > 0 && currentHeight > 0) {
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i += 1) {
          const particle = particles[i];
          if (!particle) continue;
          updateParticle(particle, delta, currentWidth, currentHeight);
        }
        onFrameRef.current?.({
          particles,
          timeSeconds: time / 1000,
          width: currentWidth,
          height: currentHeight,
        });
      }

      frames += 1;
      if (time - lastFps >= 500) {
        const fpsValue = Math.round(frames / ((time - lastFps) / 1000));
        onFpsRef.current?.(fpsValue);
        frames = 0;
        lastFps = time;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return particlesRef;
}

type ReactDomStressTestProps = {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
};

function ReactDomStressTest({
  width,
  height,
  particleCount,
  onFps,
}: ReactDomStressTestProps) {
  const domElementsRef = useRef<Array<HTMLDivElement | null>>([]);
  const domReadyRef = useRef<boolean[]>([]);

  useEffect(() => {
    const ready = domReadyRef.current;
    if (ready.length < particleCount) {
      for (let i = ready.length; i < particleCount; i += 1) {
        ready[i] = false;
      }
    } else if (ready.length > particleCount) {
      ready.length = particleCount;
    }
    domElementsRef.current.length = particleCount;
  }, [particleCount]);

  useParticleSimulation({
    width,
    height,
    particleCount,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      const elements = domElementsRef.current;
      const ready = domReadyRef.current;

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) continue;
        const element = elements[i];
        if (!element) continue;
        if (!ready[i]) {
          element.style.backgroundColor = particle.color;
          element.style.borderRadius = "999px";
          element.style.willChange = "transform, opacity";
          ready[i] = true;
        }
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        const radius = particle.size * (0.8 + 0.3 * pulse);
        element.style.width = `${radius * 2}px`;
        element.style.height = `${radius * 2}px`;
        element.style.opacity = (particle.opacity * pulse).toFixed(3);
        element.style.transform = `translate3d(${particle.x - radius}px, ${particle.y - radius}px, 0)`;
      }
    },
  });

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: STRESS_BG }}
    >
      {Array.from({ length: particleCount }).map((_, index) => (
        <div
          key={`dom-particle-${index}`}
          ref={(element) => {
            domElementsRef.current[index] = element;
          }}
          className="absolute"
        />
      ))}
    </div>
  );
}

type ReactKonvaStressTestProps = {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
};

function ReactKonvaStressTest({
  width,
  height,
  particleCount,
  onFps,
}: ReactKonvaStressTestProps) {
  const circleNodesRef = useRef<Array<Konva.Circle | null>>([]);
  const layerRef = useRef<Konva.Layer | null>(null);

  useEffect(() => {
    circleNodesRef.current.length = particleCount;
  }, [particleCount]);

  useParticleSimulation({
    width,
    height,
    particleCount,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      const nodes = circleNodesRef.current;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) continue;
        const node = nodes[i];
        if (!node) continue;
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        const radius = particle.size * (0.8 + 0.3 * pulse);
        node.position({ x: particle.x, y: particle.y });
        node.radius(radius);
        node.opacity(particle.opacity * pulse);
      }
      layerRef.current?.batchDraw();
    },
  });

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: STRESS_BG }}
    >
      <Stage width={width} height={height} className="absolute inset-0">
        <Layer ref={layerRef} listening={false}>
          {Array.from({ length: particleCount }).map((_, index) => (
            <Circle
              key={`particle-${index}`}
              ref={(node) => {
                circleNodesRef.current[index] = node;
              }}
              x={0}
              y={0}
              radius={1}
              fill={getParticleColor(index)}
              opacity={0}
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

type ReactVelloStressTestProps = {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
  context?: CanvasContext;
};

function ReactVelloStressTest({
  width,
  height,
  particleCount,
  onFps,
  context,
}: ReactVelloStressTestProps) {
  const nodeRefs = useRef<Array<MutableRectNode | null>>([]);
  const contextRef = useRef<CanvasContext | null>(context ?? null);

  useEffect(() => {
    nodeRefs.current.length = particleCount;
  }, [particleCount]);

  useEffect(() => {
    contextRef.current = context ?? null;
  }, [context]);

  useParticleSimulation({
    width,
    height,
    particleCount,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      // Mutate scene node props directly to avoid per-frame React reconciliation.
      const nodes = nodeRefs.current;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) continue;
        const node = nodes[i];
        if (!node) continue;
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        const radius = particle.size * (0.8 + 0.3 * pulse);
        const opacity = particle.opacity * pulse;
        const props = node.props;
        const origin = props.origin as [number, number] | undefined;
        const size = props.size as [number, number] | undefined;
        if (origin) {
          origin[0] = particle.x - radius;
          origin[1] = particle.y - radius;
        }
        if (size) {
          size[0] = radius * 2;
          size[1] = radius * 2;
        }
        props.opacity = opacity;
      }
      contextRef.current?.requestFrame();
    },
  });

  return (
    <Canvas width={width} height={height} backgroundColor={STRESS_BG}>
      <Group listening={false}>
        {Array.from({ length: particleCount }).map((_, index) => (
          <Rect
            key={`particle-${index}`}
            ref={(node) => {
              nodeRefs.current[index] = node as MutableRectNode | null;
            }}
            origin={[0, 0]}
            size={[1, 1]}
            radius={999}
            fill={{ kind: "solid", color: getParticleColor(index) }}
            opacity={0}
          />
        ))}
      </Group>
    </Canvas>
  );
}

function DemoScene({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const [tick, setTick] = useState(0);
  const [handles, setHandles] = useState<HandleMap>(() => ({
    start: { x: 0.12, y: 0.52 },
    control1: { x: 0.32, y: 0.18 },
    control2: { x: 0.68, y: 0.82 },
    end: { x: 0.88, y: 0.48 },
  }));
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HandleId | null>(null);
  const dragRef = useRef<{
    id: HandleId;
    pointerId: number;
    offset: Point;
  } | null>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => (t + 1) % 6000);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const base = Math.min(width, height);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  const toScreen = (point: Point): Point => ({
    x: point.x * safeWidth,
    y: point.y * safeHeight,
  });

  const screenHandles: HandleMap = {
    start: toScreen(handles.start),
    control1: toScreen(handles.control1),
    control2: toScreen(handles.control2),
    end: toScreen(handles.end),
  };

  const start = screenHandles.start;
  const control1 = screenHandles.control1;
  const control2 = screenHandles.control2;
  const end = screenHandles.end;

  const curvePath = buildCubicPath(start, control1, control2, end);
  const handleLineA = `M ${start.x} ${start.y} L ${control1.x} ${control1.y}`;
  const handleLineB = `M ${end.x} ${end.y} L ${control2.x} ${control2.y}`;

  const progress = (tick % 280) / 280;
  const tracer = getCubicPoint(progress, start, control1, control2, end);
  const tracerPulse = 0.6 + 0.4 * Math.sin(tick * 0.04);
  const tracerRadius = 4 + tracerPulse * 3;
  const haloRadius = tracerRadius + 6;
  const baseStroke = clamp(Math.round(base * 0.012), 3, 8);

  const updateHandle = (id: HandleId, position: Point) => {
    const nextX = clamp(position.x / safeWidth, 0, 1);
    const nextY = clamp(position.y / safeHeight, 0, 1);
    setHandles((prev) => ({ ...prev, [id]: { x: nextX, y: nextY } }));
  };

  const handlePointerDown = (id: HandleId) => (event: CanvasPointerEvent) => {
    event.preventDefault();
    event.capturePointer(event.pointerId);
    const handle = screenHandles[id];
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      offset: {
        x: event.position[0] - handle.x,
        y: event.position[1] - handle.y,
      },
    };
    setActiveHandle(id);
  };

  const handlePointerMove = (event: CanvasPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateHandle(drag.id, {
      x: event.position[0] - drag.offset.x,
      y: event.position[1] - drag.offset.y,
    });
  };

  const handlePointerUp = (event: CanvasPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setActiveHandle(null);
    event.releasePointerCapture(event.pointerId);
  };

  const handleNodes = HANDLE_ORDER.map((id) => {
    const handle = screenHandles[id];
    const isAnchor = id === "start" || id === "end";
    const isActive = activeHandle === id;
    const isHovered = hoveredHandle === id;
    const baseRadius = isAnchor ? 9 : 7;
    const ringRadius = baseRadius + (isActive ? 7 : isHovered ? 5 : 3);
    const color = isAnchor ? "#38bdf8" : "#a78bfa";
    const ringOpacity = isActive ? 0.38 : isHovered ? 0.25 : 0.16;

    return (
      <Group key={id}>
        <Rect
          origin={[handle.x - ringRadius, handle.y - ringRadius]}
          size={[ringRadius * 2, ringRadius * 2]}
          radius={ringRadius}
          fill={{ kind: "solid", color }}
          opacity={ringOpacity}
          listening={false}
        />
        <Rect
          origin={[handle.x - baseRadius, handle.y - baseRadius]}
          size={[baseRadius * 2, baseRadius * 2]}
          radius={baseRadius}
          fill={{ kind: "solid", color }}
          opacity={0.95}
          hitSlop={12}
          onPointerDown={handlePointerDown(id)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={() => setHoveredHandle(id)}
          onPointerLeave={() => setHoveredHandle(null)}
        />
      </Group>
    );
  });

  return (
    <Canvas width={width} height={height} backgroundColor="#0b1120">
      <Path
        d={handleLineA}
        stroke={{
          width: 1.4,
          paint: { kind: "solid", color: "#334155" },
          cap: "round",
          dash: [5, 6],
        }}
        opacity={0.55}
      />
      <Path
        d={handleLineB}
        stroke={{
          width: 1.4,
          paint: { kind: "solid", color: "#334155" },
          cap: "round",
          dash: [5, 6],
        }}
        opacity={0.55}
      />
      <Path
        d={curvePath}
        stroke={{
          width: baseStroke + 5,
          paint: { kind: "solid", color: "#1e293b" },
          cap: "round",
          join: "round",
        }}
        opacity={0.85}
      />
      <Path
        d={curvePath}
        stroke={{
          width: baseStroke,
          paint: { kind: "solid", color: "#38bdf8" },
          cap: "round",
          join: "round",
        }}
        opacity={0.9}
      />
      <Rect
        origin={[tracer.x - haloRadius, tracer.y - haloRadius]}
        size={[haloRadius * 2, haloRadius * 2]}
        radius={haloRadius}
        fill={{ kind: "solid", color: "#38bdf8" }}
        opacity={0.16}
      />
      <Rect
        origin={[tracer.x - tracerRadius, tracer.y - tracerRadius]}
        size={[tracerRadius * 2, tracerRadius * 2]}
        radius={tracerRadius}
        fill={{ kind: "solid", color: "#e2e8f0" }}
        opacity={0.92}
      />
      {handleNodes}
    </Canvas>
  );
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getParticleColor(index: number): string {
  return PARTICLE_PALETTE[index % PARTICLE_PALETTE.length] ?? "#38bdf8";
}

function createParticle(width: number, height: number, index: number): Particle {
  const size = randomBetween(0.8, 2.6);
  const speed = randomBetween(120, 520);
  const drift = randomBetween(-35, 35);
  const twinkle = randomBetween(0, Math.PI * 2);
  const opacity = randomBetween(0.4, 0.85);

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size,
    speed,
    drift,
    twinkle,
    color: getParticleColor(index),
    opacity,
  };
}

function resetParticle(particle: Particle, width: number, height: number) {
  particle.x = Math.random() * width;
  particle.y = -randomBetween(0, height * 0.4);
  particle.size = randomBetween(0.8, 2.6);
  particle.speed = randomBetween(120, 520);
  particle.drift = randomBetween(-35, 35);
  particle.twinkle = randomBetween(0, Math.PI * 2);
  particle.opacity = randomBetween(0.4, 0.85);
}

function updateParticle(particle: Particle, delta: number, width: number, height: number) {
  particle.y += particle.speed * delta;
  particle.x += particle.drift * delta;
  if (particle.y - particle.size > height + 60 || particle.x < -80 || particle.x > width + 80) {
    resetParticle(particle, width, height);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function main() {
  const host = document.querySelector<HTMLDivElement>("#app");
  if (!host) {
    throw new Error("Missing #app container");
  }

  const root = createRoot(host);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      root.unmount();
    });
  }
}

void main();
