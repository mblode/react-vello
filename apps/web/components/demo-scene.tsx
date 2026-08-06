"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  type CanvasPointerEvent,
  Group,
  Path,
  Rect,
} from "react-vello";

import { InfoPanel } from "@/components/info-panel";
import { VelloSurface, type VelloScene } from "@/components/vello-surface";
import { CANVAS_BG, HANDLE_COLOR, SCENE_INK } from "@/lib/scene-colors";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { clamp, lerp } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

type HandleId = "start" | "control1" | "control2" | "end";
type HandleMap = Record<HandleId, Point>;

const HANDLE_ORDER: HandleId[] = ["start", "control1", "control2", "end"];
const TRACER_PERIOD_MS = 4500;
/** Where the dot parks when the visitor has asked for less motion. */
const TRACER_STATIC_T = 0.35;
const TRACER_RADIUS = 5;
const HALO_RADIUS = 11;

const DEMO_SUMMARY =
  "Drag any of the four handles. The dot is the curve evaluated live, not a path animation.";

const DEMO_DETAIL = [
  "The thin lines show each control point's pull on the end it belongs to. The dot is de Casteljau's algorithm run at a moving t every frame, which is why it slows through the tight part of a bend and speeds up through the straight.",
  "None of the rendering shows up on the React side. The scene is written as Canvas, Group, Path and Rect components with props, and a custom React reconciler turns that tree into a scene graph which Rust encodes and Vello rasterises on the GPU. Pointer events come back out the same way, so dragging a handle is an ordinary event on a shape rather than hit-testing coordinates against a canvas by hand.",
] as const;

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
    ({ width, height, context }: VelloScene) => (
      <BezierScene context={context} height={height} width={width} />
    ),
    []
  );

  return (
    <>
      <VelloSurface
        label="Interactive cubic Bézier curve with four draggable handles"
        scene={scene}
      />
      <InfoPanel
        detail={DEMO_DETAIL}
        label="Cubic Bézier"
        summary={DEMO_SUMMARY}
      />
    </>
  );
}

function BezierScene({ width, height, context }: VelloScene) {
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
  const prefersReducedMotion = usePrefersReducedMotion();

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

  const { start, control1, control2, end } = screenHandles;

  // The frame loop reads the live handle positions without re-subscribing, so
  // dragging never restarts the animation.
  const geometryRef = useRef(screenHandles);
  geometryRef.current = screenHandles;

  // Owned by the frame loop and mutated in place. The reconciler stores the
  // array it was handed rather than copying it, so passing the same identity
  // back through JSX means a re-render never clobbers what the loop just wrote,
  // and the loop never has to reach for a node ref.
  const tracerOrigin = useRef<[number, number]>([0, 0]).current;
  const haloOrigin = useRef<[number, number]>([0, 0]).current;

  useEffect(() => {
    const place = (t: number) => {
      const geometry = geometryRef.current;
      const point = getCubicPoint(
        t,
        geometry.start,
        geometry.control1,
        geometry.control2,
        geometry.end
      );
      tracerOrigin[0] = point.x - TRACER_RADIUS;
      tracerOrigin[1] = point.y - TRACER_RADIUS;
      haloOrigin[0] = point.x - HALO_RADIUS;
      haloOrigin[1] = point.y - HALO_RADIUS;
      context.requestFrame();
    };

    if (prefersReducedMotion) {
      place(TRACER_STATIC_T);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();
    const loop = (time: number) => {
      place(((time - startedAt) % TRACER_PERIOD_MS) / TRACER_PERIOD_MS);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [context, prefersReducedMotion, tracerOrigin, haloOrigin]);

  const curvePath = buildCubicPath(start, control1, control2, end);
  const handleLineA = `M ${start.x} ${start.y} L ${control1.x} ${control1.y}`;
  const handleLineB = `M ${end.x} ${end.y} L ${control2.x} ${control2.y}`;
  const baseStroke = clamp(Math.round(Math.min(width, height) * 0.012), 3, 8);

  const updateHandle = (id: HandleId, position: Point) => {
    setHandles((prev) => ({
      ...prev,
      [id]: {
        x: clamp(position.x / safeWidth, 0, 1),
        y: clamp(position.y / safeHeight, 0, 1),
      },
    }));
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

  const guideStroke = {
    width: 1.4,
    paint: { kind: "solid", color: SCENE_INK.guide },
    cap: "round",
    dash: [5, 6],
  } as const;

  const handleNodes = HANDLE_ORDER.map((id) => {
    const handle = screenHandles[id];
    const isAnchor = id === "start" || id === "end";
    const isActive = activeHandle === id;
    const isHovered = hoveredHandle === id;
    const baseRadius = isAnchor ? 9 : 7;

    let ringBoost = 3;
    let ringOpacity = 0.16;
    if (isActive) {
      ringBoost = 7;
      ringOpacity = 0.38;
    } else if (isHovered) {
      ringBoost = 5;
      ringOpacity = 0.25;
    }

    const ringRadius = baseRadius + ringBoost;
    const color = isAnchor ? HANDLE_COLOR.anchor : HANDLE_COLOR.control;

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
    <Canvas backgroundColor={CANVAS_BG} height={height} width={width}>
      <Path d={handleLineA} opacity={0.55} stroke={guideStroke} />
      <Path d={handleLineB} opacity={0.55} stroke={guideStroke} />
      <Path
        d={curvePath}
        opacity={0.85}
        stroke={{
          width: baseStroke + 5,
          paint: { kind: "solid", color: SCENE_INK.curveShadow },
          cap: "round",
          join: "round",
        }}
      />
      <Path
        d={curvePath}
        opacity={0.9}
        stroke={{
          width: baseStroke,
          paint: { kind: "solid", color: HANDLE_COLOR.anchor },
          cap: "round",
          join: "round",
        }}
      />
      <Rect
        fill={{ kind: "solid", color: HANDLE_COLOR.anchor }}
        listening={false}
        opacity={0.16}
        origin={haloOrigin}
        radius={HALO_RADIUS}
        size={[HALO_RADIUS * 2, HALO_RADIUS * 2]}
      />
      <Rect
        fill={{ kind: "solid", color: SCENE_INK.tracer }}
        listening={false}
        opacity={0.92}
        origin={tracerOrigin}
        radius={TRACER_RADIUS}
        size={[TRACER_RADIUS * 2, TRACER_RADIUS * 2]}
      />
      {handleNodes}
    </Canvas>
  );
}
