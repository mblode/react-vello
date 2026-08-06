"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CanvasContext,
  createVelloRoot,
  type VelloRoot,
} from "react-vello";

export interface VelloScene {
  width: number;
  height: number;
  context: CanvasContext;
  /**
   * False once the canvas has scrolled out of view. Scenes that animate should
   * park their frame loop on this: the demo page scrolls now, so a tracer that
   * kept running would be burning a GPU frame every 16ms behind the prose.
   */
  visible: boolean;
}

interface VelloSurfaceProps {
  /** Names this specific scene for screen readers; the canvas has no text. */
  label: string;
  /**
   * Renders the scene graph for the current size. Must be referentially stable
   * across renders that should not re-render the scene — wrap it in useCallback
   * with whatever it actually depends on.
   */
  scene: (frame: VelloScene) => React.ReactNode;
}

export function VelloSurface({ label, scene }: VelloSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [root, setRoot] = useState<VelloRoot | null>(null);
  const [backend, setBackend] = useState<CanvasContext["backend"] | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // `?debug` turns on per-stage frame timings. Off by default so the
    // collector is never even allocated for ordinary visitors.
    const debug = new URLSearchParams(window.location.search).has("debug");

    const velloRoot = createVelloRoot(canvas, {
      debug,
      // The renderer degrades to a Canvas 2D software path rather than failing,
      // so both callbacks land on the same question: which backend did we get?
      onReady: (context) => setBackend(context.backend),
      onError: (error: unknown) => {
        console.error("[rvello] WebGPU renderer error", error);
      },
    });
    setRoot(velloRoot);

    const report = debug
      ? window.setInterval(() => {
          const stats = velloRoot.getContext().getStats();
          if (stats?.frames) {
            console.log(
              `[rvello] ${stats.ops} ops, ${(stats.bytes / 1024).toFixed(0)}KB | ` +
                `encode p50 ${stats.encode.p50.toFixed(2)}ms p95 ${stats.encode.p95.toFixed(2)}ms | ` +
                `submit p50 ${stats.submit.p50.toFixed(2)}ms p95 ${stats.submit.p95.toFixed(2)}ms`
            );
          }
        }, 1000)
      : undefined;

    return () => {
      if (report !== undefined) {
        window.clearInterval(report);
      }
      velloRoot.unmount();
      setRoot(null);
    };
  }, []);

  // Measured from the host rather than the viewport. The canvas is a grid row
  // on a phone and pinned full-bleed from `md` up, so `window.innerHeight` is
  // the wrong number in one of those cases and stale on iOS in both — a
  // `resize` listener never fires when the URL bar collapses.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const measure = (width: number, height: number) => {
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    };

    // Seeded synchronously rather than waiting for the observer's first
    // callback. That callback is the only thing that ever sets a size, so if it
    // reports a not-yet-laid-out box the surface stays at zero and never draws
    // — and nothing wakes it up, because the box never changes afterwards.
    const box = host.getBoundingClientRect();
    measure(box.width, box.height);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const next = entry.contentRect;
      measure(next.width, next.height);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) {
        return;
      }
      // The first callback can arrive before the host has been laid out, and a
      // zero-area box reports as "not intersecting". Taking that at face value
      // parks the scene before it has drawn anything, and since the box never
      // crosses a threshold afterwards nothing ever wakes it up again. Pausing
      // is an optimisation, so when in doubt keep rendering.
      const box = entry.boundingClientRect;
      if (box.width === 0 && box.height === 0) {
        return;
      }
      setVisible(entry.isIntersecting);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!root || size.width === 0 || size.height === 0) {
      return;
    }
    root.render(
      scene({
        width: size.width,
        height: size.height,
        context: root.getContext(),
        visible,
      })
    );
  }, [root, size.width, size.height, scene, visible]);

  return (
    <div className="absolute inset-0" ref={hostRef}>
      <canvas
        aria-label={label}
        className="absolute inset-0 block"
        ref={canvasRef}
        role="img"
      />
      {backend === "canvas" && (
        <p className="-translate-x-1/2 absolute top-[calc(var(--header-height)+0.5rem)] left-1/2 z-10 rounded-full border border-border bg-card/85 px-3 py-1 text-muted-foreground text-xs backdrop-blur-md">
          No WebGPU here, so this is the Canvas 2D fallback.
        </p>
      )}
    </div>
  );
}
