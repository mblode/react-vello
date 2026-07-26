"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CanvasContext,
  createVelloRoot,
  type VelloRoot,
} from "react-vello";

import { useViewportSize } from "@/lib/particles";

export interface VelloScene {
  width: number;
  height: number;
  context: CanvasContext;
}

interface VelloSurfaceProps {
  /**
   * Renders the scene graph for the current size. Must be referentially stable
   * across renders that should not re-render the scene — wrap it in useCallback
   * with whatever it actually depends on.
   */
  scene: (frame: VelloScene) => React.ReactNode;
}

export function VelloSurface({ scene }: VelloSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [root, setRoot] = useState<VelloRoot | null>(null);
  const size = useViewportSize();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const velloRoot = createVelloRoot(canvas, {
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
    <canvas
      aria-label="WebGPU canvas demo"
      className="absolute inset-0 block"
      ref={canvasRef}
    />
  );
}
