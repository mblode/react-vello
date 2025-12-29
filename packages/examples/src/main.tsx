import "./style.css";
import {
  StrictMode,
  useCallback,
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
  createVelloRoot,
  type VelloRoot,
} from "@react-vello/core";

type SupportStatus =
  | { ok: true }
  | { ok: false; reason: string; hint?: string };

type PointerState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  prevX: number;
  prevY: number;
  down: boolean;
  speed: number;
};

type Burst = {
  x: number;
  y: number;
  started: number;
  duration: number;
  color: string;
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

const BURST_PALETTE = ["#22d3ee", "#38bdf8", "#a78bfa", "#f97316"];

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function buildCirclePath(cx: number, cy: number, radius: number): string {
  const r = Math.max(0, radius);
  const startX = cx + r;
  const startY = cy;
  return `M ${startX} ${startY} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${startX} ${startY}`;
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
  const pointerRef = useRef<PointerState>({
    x: width * 0.5,
    y: height * 0.5,
    targetX: width * 0.5,
    targetY: height * 0.5,
    prevX: width * 0.5,
    prevY: height * 0.5,
    down: false,
    speed: 0,
  });
  const burstsRef = useRef<Burst[]>([]);

  const spawnBurst = useCallback((x: number, y: number) => {
    const now = performance.now();
    const paletteIndex = Math.floor(now / 120) % BURST_PALETTE.length;
    const color = BURST_PALETTE[paletteIndex];
    const bursts = burstsRef.current;
    bursts.push({ x, y, started: now, duration: 900, color });
    if (bursts.length > 8) {
      bursts.shift();
    }
  }, []);

  useEffect(() => {
    const pointer = pointerRef.current;
    pointer.x = width * 0.5;
    pointer.y = height * 0.5;
    pointer.targetX = pointer.x;
    pointer.targetY = pointer.y;
    pointer.prevX = pointer.x;
    pointer.prevY = pointer.y;
  }, [width, height]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const x = clamp(event.clientX, 0, width);
      const y = clamp(event.clientY, 0, height);
      const pointer = pointerRef.current;
      pointer.targetX = x;
      pointer.targetY = y;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const x = clamp(event.clientX, 0, width);
      const y = clamp(event.clientY, 0, height);
      const pointer = pointerRef.current;
      pointer.down = true;
      pointer.targetX = x;
      pointer.targetY = y;
      spawnBurst(x, y);
    };

    const handlePointerUp = () => {
      pointerRef.current.down = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
    };
  }, [width, height, spawnBurst]);

  useEffect(() => {
    let raf: number;
    let lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      const pointer = pointerRef.current;
      const ease = pointer.down ? 0.24 : 0.14;
      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;

      const dx = pointer.x - pointer.prevX;
      const dy = pointer.y - pointer.prevY;
      const move = Math.hypot(dx, dy);
      const targetSpeed = clamp(move / 20, 0, 1);
      pointer.speed = lerp(pointer.speed, targetSpeed, 0.2);
      pointer.prevX = pointer.x;
      pointer.prevY = pointer.y;

      const bursts = burstsRef.current;
      burstsRef.current = bursts.filter(
        (burst) => now - burst.started < burst.duration,
      );

      setTick((t) => (t + 1) % 3600);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = tick * 0.02;
  const now = performance.now();
  const pointer = pointerRef.current;
  const pulse = (Math.sin(t) + 1) / 2;
  const base = Math.min(width, height);
  const padding = clamp(Math.round(base * 0.08), 24, 72);
  const contentWidth = Math.max(0, width - padding * 2);
  const pointerBlend = clamp(pointer.speed + (pointer.down ? 0.55 : 0), 0, 1);
  const pointerBiasX = (pointer.x - width * 0.5) / Math.max(1, width);
  const pointerBiasY = (pointer.y - height * 0.5) / Math.max(1, height);
  const waveHeight = clamp(Math.round(height * 0.22), 80, 220);
  const waveAmplitude =
    Math.min(waveHeight * 0.34, 42) + pulse * 12 + pointerBlend * 22;
  const waveOffset =
    Math.sin(t * 0.6 + pointerBiasX * 1.4) * 10 + pointerBiasX * 22;
  const wavePath = buildWavePath(
    contentWidth,
    waveHeight,
    waveAmplitude,
    0,
    waveOffset,
  );
  const wavePathSoft = buildWavePath(
    contentWidth,
    waveHeight,
    waveAmplitude * 0.55,
    0,
    waveOffset * 0.6,
  );
  const waveY = clamp(
    padding + height * 0.5 + pointerBiasY * waveHeight * 0.35,
    padding + waveHeight * 0.25,
    height - padding - waveHeight * 0.25,
  );
  const nodeCount = clamp(Math.round(contentWidth / 180), 4, 9);
  const nodeGap = nodeCount > 1 ? contentWidth / (nodeCount - 1) : 0;

  const burstNodes = burstsRef.current.map((burst, index) => {
    const progress = clamp((now - burst.started) / burst.duration, 0, 1);
    const radius = lerp(12, 150, progress);
    const opacity = (1 - progress) * 0.5;
    return (
      <Path
        key={`burst-${index}-${burst.started}`}
        d={buildCirclePath(burst.x, burst.y, radius)}
        stroke={{
          width: 2.5,
          paint: { kind: "solid", color: burst.color },
          cap: "round",
        }}
        opacity={opacity}
      />
    );
  });

  const haloSize = 100 + pointerBlend * 160;
  const haloNode = (
    <Rect
      origin={[pointer.x - haloSize / 2, pointer.y - haloSize / 2]}
      size={[haloSize, haloSize]}
      radius={haloSize / 2}
      fill={{ kind: "solid", color: "#38bdf8" }}
      opacity={0.08 + pointerBlend * 0.12}
    />
  );
  const ringNode = (
    <Path
      d={buildCirclePath(pointer.x, pointer.y, 32 + pointerBlend * 48)}
      stroke={{
        width: 2,
        paint: { kind: "solid", color: "#38bdf8" },
        cap: "round",
      }}
      opacity={0.2 + pointerBlend * 0.5}
    />
  );
  const coreNode = (
    <Rect
      origin={[pointer.x - 3, pointer.y - 3]}
      size={[6, 6]}
      radius={3}
      fill={{ kind: "solid", color: "#e2e8f0" }}
      opacity={0.8}
    />
  );

  const nodeNodes: JSX.Element[] = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const x = padding + i * nodeGap;
    const phase = t * (0.6 + pointerBlend * 0.45) + i * 0.7;
    const y =
      waveY +
      Math.sin(phase) * (waveAmplitude * (0.5 + pointerBlend * 0.25));
    const size = i % 3 === 0 ? 9 : 6;
    const color = i % 2 === 0 ? "#38bdf8" : "#22d3ee";
    const glow = 0.4 + 0.6 * Math.sin(phase + t);
    nodeNodes.push(
      <Rect
        key={`node-${i}`}
        origin={[x - size / 2, y - size / 2]}
        size={[size, size]}
        radius={size / 2}
        fill={{ kind: "solid", color }}
        opacity={0.55 + glow * 0.35}
      />,
    );
  }

  return (
    <Canvas width={width} height={height} backgroundColor="#0b1120">
      <Rect
        origin={[-contentWidth * 0.2, -contentWidth * 0.15]}
        size={[contentWidth * 0.7, contentWidth * 0.7]}
        radius={contentWidth * 0.35}
        fill={{ kind: "solid", color: "#38bdf8" }}
        opacity={0.08}
      />
      <Rect
        origin={[width - contentWidth * 0.55, height - contentWidth * 0.45]}
        size={[contentWidth * 0.6, contentWidth * 0.6]}
        radius={contentWidth * 0.3}
        fill={{ kind: "solid", color: "#a78bfa" }}
        opacity={0.08}
      />
      <Group transform={[1, 0, 0, 1, padding, waveY - waveHeight / 2]}>
        <Path
          d={wavePathSoft}
          stroke={{
            width: 3,
            paint: { kind: "solid", color: "#22d3ee" },
            cap: "round",
          }}
          opacity={0.4}
        />
      </Group>
      <Group transform={[1, 0, 0, 1, padding, waveY - waveHeight / 2]}>
        <Path
          d={wavePath}
          stroke={{
            width: 4,
            paint: { kind: "solid", color: "#38bdf8" },
            cap: "round",
          }}
          opacity={0.9}
        />
      </Group>
      {nodeNodes}
      {haloNode}
      {burstNodes}
      {ringNode}
      {coreNode}
    </Canvas>
  );
}

function buildWavePath(
  width: number,
  height: number,
  amplitude: number,
  inset: number,
  offset: number,
): string {
  const midY = height / 2 + offset;
  const startX = inset;
  const endX = width - inset;
  const span = endX - startX;
  const c1 = startX + span * 0.25;
  const c2 = startX + span * 0.5;
  const c3 = startX + span * 0.75;
  return `M ${startX} ${midY} C ${c1} ${midY - amplitude}, ${c2} ${
    midY + amplitude
  }, ${c3} ${midY - amplitude} S ${endX} ${midY + amplitude}, ${endX} ${midY}`;
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
