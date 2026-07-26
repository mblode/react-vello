"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  type CanvasPointerEvent,
  Group,
  Path,
  Rect,
} from "react-vello";

import { VelloSurface } from "@/components/vello-surface";
import { clamp } from "@/lib/particles";

interface Point {
  x: number;
  y: number;
}

type HandleId = "start" | "control1" | "control2" | "end";
type HandleMap = Record<HandleId, Point>;

const HANDLE_ORDER: HandleId[] = ["start", "control1", "control2", "end"];
const TRACER_PERIOD_TICKS = 280;
const TICK_WRAP = 6000;

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function buildCubicPath(
  start: Point,
  c1: Point,
  c2: Point,
  end: Point
): string {
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function getCubicPoint(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point
): Point {
  const a = { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
  const b = { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) };
  const c = { x: lerp(p2.x, p3.x, t), y: lerp(p2.y, p3.y, t) };
  const d = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  const e = { x: lerp(b.x, c.x, t), y: lerp(b.y, c.y, t) };
  return { x: lerp(d.x, e.x, t), y: lerp(d.y, e.y, t) };
}

export function DemoScene() {
  const scene = useCallback(
    ({ width, height }: { width: number; height: number }) => (
      <BezierScene height={height} width={width} />
    ),
    []
  );

  return <VelloSurface scene={scene} />;
}

function BezierScene({ width, height }: { width: number; height: number }) {
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
      setTick((t) => (t + 1) % TICK_WRAP);
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

  const progress = (tick % TRACER_PERIOD_TICKS) / TRACER_PERIOD_TICKS;
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
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    updateHandle(drag.id, {
      x: event.position[0] - drag.offset.x,
      y: event.position[1] - drag.offset.y,
    });
  };

  const handlePointerUp = (event: CanvasPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
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
    let ringBoost = 3;
    if (isActive) {
      ringBoost = 7;
    } else if (isHovered) {
      ringBoost = 5;
    }
    const ringRadius = baseRadius + ringBoost;
    const color = isAnchor ? "#38bdf8" : "#a78bfa";
    let ringOpacity = 0.16;
    if (isActive) {
      ringOpacity = 0.38;
    } else if (isHovered) {
      ringOpacity = 0.25;
    }

    return (
      <Group key={id}>
        <Rect
          fill={{ kind: "solid", color }}
          listening={false}
          opacity={ringOpacity}
          origin={[handle.x - ringRadius, handle.y - ringRadius]}
          radius={ringRadius}
          size={[ringRadius * 2, ringRadius * 2]}
        />
        <Rect
          fill={{ kind: "solid", color }}
          hitSlop={12}
          onPointerDown={handlePointerDown(id)}
          onPointerEnter={() => setHoveredHandle(id)}
          onPointerLeave={() => setHoveredHandle(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          opacity={0.95}
          origin={[handle.x - baseRadius, handle.y - baseRadius]}
          radius={baseRadius}
          size={[baseRadius * 2, baseRadius * 2]}
        />
      </Group>
    );
  });

  return (
    <Canvas backgroundColor="#0b1120" height={height} width={width}>
      <Path
        d={handleLineA}
        opacity={0.55}
        stroke={{
          width: 1.4,
          paint: { kind: "solid", color: "#334155" },
          cap: "round",
          dash: [5, 6],
        }}
      />
      <Path
        d={handleLineB}
        opacity={0.55}
        stroke={{
          width: 1.4,
          paint: { kind: "solid", color: "#334155" },
          cap: "round",
          dash: [5, 6],
        }}
      />
      <Path
        d={curvePath}
        opacity={0.85}
        stroke={{
          width: baseStroke + 5,
          paint: { kind: "solid", color: "#1e293b" },
          cap: "round",
          join: "round",
        }}
      />
      <Path
        d={curvePath}
        opacity={0.9}
        stroke={{
          width: baseStroke,
          paint: { kind: "solid", color: "#38bdf8" },
          cap: "round",
          join: "round",
        }}
      />
      <Rect
        fill={{ kind: "solid", color: "#38bdf8" }}
        opacity={0.16}
        origin={[tracer.x - haloRadius, tracer.y - haloRadius]}
        radius={haloRadius}
        size={[haloRadius * 2, haloRadius * 2]}
      />
      <Rect
        fill={{ kind: "solid", color: "#e2e8f0" }}
        opacity={0.92}
        origin={[tracer.x - tracerRadius, tracer.y - tracerRadius]}
        radius={tracerRadius}
        size={[tracerRadius * 2, tracerRadius * 2]}
      />
      {handleNodes}
    </Canvas>
  );
}
