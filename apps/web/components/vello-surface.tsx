"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CanvasContext,
  createVelloRoot,
  type VelloRoot,
} from "react-vello";

import { useViewportSize } from "@/lib/use-viewport-size";

export interface VelloScene {
  width: number;
  height: number;
  context: CanvasContext;
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [root, setRoot] = useState<VelloRoot | null>(null);
  const [backend, setBackend] = useState<CanvasContext["backend"] | null>(null);
  const size = useViewportSize();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const velloRoot = createVelloRoot(canvas, {
      // The renderer degrades to a Canvas 2D software path rather than failing,
      // so both callbacks land on the same question: which backend did we get?
      onReady: (context) => setBackend(context.backend),
      onError: (error: unknown) => {
        console.error("[rvello] WebGPU renderer error", error);
      },
    });
    setRoot(velloRoot);

    return () => {
      velloRoot.unmount();
      setRoot(null);
    };
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
      })
    );
  }, [root, size.width, size.height, scene]);

  return (
    <>
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
    </>
  );
}
