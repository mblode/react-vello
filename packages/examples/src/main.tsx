import "./style.css";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Canvas,
  Group,
  Path,
  Rect,
  Text,
  createVelloRoot,
  type VelloRoot,
} from "@react-vello/core";

type SupportStatus =
  | { ok: true }
  | { ok: false; reason: string; hint?: string };

type RendererMode = "webgpu" | "unavailable" | "loading";

type StatusState = "ok" | "error" | "loading";

type HudState = {
  status: StatusState;
  statusLabel: string;
  statsLabel: string;
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

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const velloRootRef = useRef<VelloRoot | null>(null);
  const frameTracker = useRef({ lastTime: 0, frames: 0 });
  const loggedFrame = useRef(false);

  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>("loading");
  const [fps, setFps] = useState(0);

  const size = useViewportSize();

  const handleFrame = useCallback((ops: Uint8Array) => {
    if (!loggedFrame.current) {
      console.debug("[rvello] encoded frame buffer", ops.byteLength, "bytes");
      loggedFrame.current = true;
    }

    const now = performance.now();
    const tracker = frameTracker.current;
    if (tracker.lastTime === 0) {
      tracker.lastTime = now;
    }
    tracker.frames += 1;

    const elapsed = now - tracker.lastTime;
    if (elapsed >= 500) {
      const nextFps = Math.round((tracker.frames * 1000) / elapsed);
      setFps(nextFps);
      tracker.frames = 0;
      tracker.lastTime = now;
    }
  }, []);

  useEffect(() => {
    let active = true;
    detectWebGPU().then((result) => {
      if (!active) return;
      setStatus(result);
      setRendererMode(result.ok ? "loading" : "unavailable");
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
      setFps(0);
      return;
    }

    setRendererMode("loading");

    const root = createVelloRoot(canvas, {
      onFrame: handleFrame,
      onReady: () => {
        setRendererMode("webgpu");
      },
      onError: (error) => {
        console.error("[rvello] WebGPU renderer error", error);
        setRendererMode("unavailable");
      },
    });

    velloRootRef.current = root;

    return () => {
      root.unmount();
      if (velloRootRef.current === root) {
        velloRootRef.current = null;
      }
    };
  }, [status?.ok, handleFrame]);

  const statusState: StatusState = status
    ? status.ok
      ? "ok"
      : "error"
    : "loading";
  const statusLabel = status
    ? status.ok
      ? "WebGPU ready"
      : "WebGPU required"
    : "Checking WebGPU";
  const fpsLabel = fps > 0 ? fps.toString() : "--";
  const rendererLabel =
    rendererMode === "webgpu"
      ? "WebGPU"
      : rendererMode === "loading"
        ? "Initializing"
        : "Unavailable";
  const statsLabel = `FPS ${fpsLabel} \u00b7 ${rendererLabel} \u00b7 ${size.width}x${size.height}`;
  const hud: HudState = { status: statusState, statusLabel, statsLabel };

  useEffect(() => {
    const root = velloRootRef.current;
    if (!root || !status?.ok || size.width === 0 || size.height === 0) return;
    root.render(<DemoScene width={size.width} height={size.height} hud={hud} />);
  }, [
    status?.ok,
    size.width,
    size.height,
    hud.status,
    hud.statusLabel,
    hud.statsLabel,
  ]);

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
  hud,
}: {
  width: number;
  height: number;
  hud: HudState;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => (t + 1) % 3600);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = tick * 0.02;
  const pulse = (Math.sin(t) + 1) / 2;
  const base = Math.min(width, height);
  const padding = clamp(Math.round(base * 0.06), 20, 64);
  const gap = clamp(Math.round(base * 0.035), 12, 28);
  const columns = clamp(Math.floor(width / 260), 2, 7);
  const rows = clamp(Math.floor(height / 200), 2, 6);
  const gridWidth = Math.max(0, width - padding * 2);
  const gridHeight = Math.max(0, height - padding * 2);
  const cellWidth = Math.max(0, (gridWidth - gap * (columns - 1)) / columns);
  const cellHeight = Math.max(0, (gridHeight - gap * (rows - 1)) / rows);
  const waveHeight = clamp(Math.round(height * 0.18), 80, 180);
  const waveAmplitude = Math.min(waveHeight * 0.3, 32) + pulse * 6;
  const wavePath = buildWavePath(gridWidth, waveHeight, waveAmplitude, 0);
  const wavePathSoft = buildWavePath(gridWidth, waveHeight, waveAmplitude * 0.55, 0);
  const waveY = padding + gridHeight * 0.58;
  const nodeCount = clamp(Math.round(width / 180), 4, 12);
  const nodeGap = nodeCount > 1 ? gridWidth / (nodeCount - 1) : 0;
  const activeColumn = Math.round(((Math.sin(t * 0.4) + 1) / 2) * (columns - 1));
  const activeRow = Math.round(((Math.cos(t * 0.35) + 1) / 2) * (rows - 1));
  const hudPanelWidth = clamp(Math.round(gridWidth * 0.28), 220, 360);
  const hudPanelHeight = 64;
  const hudStatusColor =
    hud.status === "ok"
      ? "#22c55e"
      : hud.status === "loading"
        ? "#38bdf8"
        : "#f97316";
  const hudLabel = hud.statusLabel.toUpperCase();

  const cellNodes: JSX.Element[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = padding + col * (cellWidth + gap);
      const y = padding + row * (cellHeight + gap);
      const tone = (row + col) % 3;
      const isActive = row === activeRow || col === activeColumn;
      const headline = cellWidth * (0.45 + tone * 0.12);
      const subline = headline * 0.6;
      const chip = isActive ? "#38bdf8" : "#1e293b";
      const accent = isActive ? "#22d3ee" : "#1f2937";
      const footerWidth = cellWidth * (isActive ? 0.5 : 0.32);
      cellNodes.push(
        <Group key={`cell-${row}-${col}`} transform={[1, 0, 0, 1, x, y]}>
          <Rect
            origin={[0, 0]}
            size={[cellWidth, cellHeight]}
            radius={16}
            fill={{ kind: "solid", color: "#0f172a" }}
            opacity={0.78}
          />
          <Rect
            origin={[16, 16]}
            size={[headline, 8]}
            radius={4}
            fill={{ kind: "solid", color: "#1f2937" }}
            opacity={0.6}
          />
          <Rect
            origin={[16, 32]}
            size={[subline, 6]}
            radius={3}
            fill={{ kind: "solid", color: "#1f2937" }}
            opacity={0.4}
          />
          <Rect
            origin={[16, Math.max(16, cellHeight - 20)]}
            size={[footerWidth, 8]}
            radius={4}
            fill={{ kind: "solid", color: accent }}
            opacity={isActive ? 0.9 : 0.35}
          />
          <Rect
            origin={[Math.max(8, cellWidth - 22), 16]}
            size={[8, 8]}
            radius={4}
            fill={{ kind: "solid", color: chip }}
            opacity={isActive ? 0.9 : 0.5}
          />
        </Group>,
      );
    }
  }

  const nodeNodes: JSX.Element[] = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const x = padding + i * nodeGap;
    const phase = t * 0.45 + i * 0.6;
    const y = waveY + Math.sin(phase) * (waveAmplitude * 0.6);
    const size = i % 3 === 0 ? 8 : 6;
    const color = i % 3 === 0 ? "#38bdf8" : "#22d3ee";
    nodeNodes.push(
      <Rect
        key={`node-${i}`}
        origin={[x - size / 2, y - size / 2]}
        size={[size, size]}
        radius={size / 2}
        fill={{ kind: "solid", color }}
        opacity={0.9}
      />,
    );
  }

  return (
    <Canvas
      width={width}
      height={height}
      backgroundColor="#0b1120"
    >
      <Rect
        origin={[-gridWidth * 0.2, -gridHeight * 0.15]}
        size={[gridWidth * 0.7, gridWidth * 0.7]}
        radius={gridWidth * 0.35}
        fill={{ kind: "solid", color: "#38bdf8" }}
        opacity={0.08}
      />
      <Rect
        origin={[width - gridWidth * 0.55, height - gridWidth * 0.45]}
        size={[gridWidth * 0.6, gridWidth * 0.6]}
        radius={gridWidth * 0.3}
        fill={{ kind: "solid", color: "#a78bfa" }}
        opacity={0.08}
      />
      {cellNodes}
      <Group transform={[1, 0, 0, 1, padding, waveY - waveHeight / 2]}>
        <Path
          d={wavePathSoft}
          stroke={{
            width: 3,
            paint: { kind: "solid", color: "#22d3ee" },
            cap: "round",
          }}
          opacity={0.5}
        />
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
      <Group transform={[1, 0, 0, 1, padding, padding]}>
        <Rect
          origin={[0, 0]}
          size={[hudPanelWidth, hudPanelHeight]}
          radius={12}
          fill={{ kind: "solid", color: "#0f172a" }}
          opacity={0.82}
        />
        <Rect
          origin={[14, 14]}
          size={[8, 8]}
          radius={4}
          fill={{ kind: "solid", color: hudStatusColor }}
          opacity={0.9}
        />
        <Text
          text={hudLabel}
          origin={[28, 8]}
          font={{ family: "Space Grotesk", size: 12, weight: 600, lineHeight: 16 }}
          fill={{ kind: "solid", color: "#e2e8f0" }}
        />
        <Text
          text={hud.statsLabel}
          origin={[28, 30]}
          maxWidth={hudPanelWidth - 36}
          font={{ family: "Space Grotesk", size: 11, weight: 500, lineHeight: 14 }}
          fill={{ kind: "solid", color: "#94a3b8" }}
        />
      </Group>
    </Canvas>
  );
}

function buildWavePath(
  width: number,
  height: number,
  amplitude: number,
  inset: number,
): string {
  const midY = height / 2;
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
