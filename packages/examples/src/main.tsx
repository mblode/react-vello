import "./style.css";
import {
  StrictMode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Canvas,
  Group,
  Path,
  Rect,
  Text,
  createVelloRoot,
  type VelloRoot,
  type CanvasPointerEvent,
} from "react-vello";

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
const HANDLE_LABELS: Record<HandleId, string> = {
  start: "Start",
  control1: "Control A",
  control2: "Control B",
  end: "End",
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
    if (!status?.ok || !canvas) {
      velloRootRef.current?.unmount();
      velloRootRef.current = null;
      return;
    }

    const root = createVelloRoot(canvas, {
      onError: (error) => {
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
  }, [status?.ok]);

  useEffect(() => {
    const root = velloRootRef.current;
    if (!root || !status?.ok || size.width === 0 || size.height === 0) return;
    root.render(<DemoScene width={size.width} height={size.height} />);
  }, [status?.ok, size.width, size.height]);

  return (
    <div className="app">
      <canvas
        ref={canvasRef}
        className="vello-canvas"
        aria-label="WebGPU canvas demo"
      ></canvas>
    </div>
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
  const padding = clamp(Math.round(base * 0.09), 32, 72);
  const frameWidth = Math.max(0, width - padding * 2);
  const frameHeight = Math.max(0, height - padding * 2);
  const safeWidth = Math.max(1, frameWidth);
  const safeHeight = Math.max(1, frameHeight);
  const frameRadius = clamp(Math.round(base * 0.04), 18, 28);

  const toScreen = (point: Point): Point => ({
    x: padding + point.x * safeWidth,
    y: padding + point.y * safeHeight,
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
    const nextX = clamp((position.x - padding) / safeWidth, 0, 1);
    const nextY = clamp((position.y - padding) / safeHeight, 0, 1);
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

  const statusPoint = activeHandle ? screenHandles[activeHandle] : null;
  const statusLabel = activeHandle && statusPoint
    ? `${HANDLE_LABELS[activeHandle]}: ${Math.round(statusPoint.x)}, ${Math.round(statusPoint.y)}`
    : "Drag points to edit the curve";

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
      <Rect
        origin={[padding, padding]}
        size={[frameWidth, frameHeight]}
        radius={frameRadius}
        fill={{ kind: "solid", color: "#0f172a" }}
        stroke={{ width: 1, paint: { kind: "solid", color: "#1f2937" } }}
        opacity={0.96}
      />
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
      <Text
        origin={[padding + 20, padding + 18]}
        font={{ family: "Space Grotesk", size: 16, weight: 600, lineHeight: 20 }}
        fill={{ kind: "solid", color: "#e2e8f0" }}
      >
        Bezier Workbench
      </Text>
      <Text
        origin={[padding + 20, padding + 38]}
        maxWidth={Math.max(0, frameWidth - 40)}
        font={{ family: "Space Grotesk", size: 11, weight: 500, lineHeight: 14 }}
        fill={{ kind: "solid", color: "#94a3b8" }}
      >
        {statusLabel}
      </Text>
    </Canvas>
  );
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
