"use client";

import { useEffect, useState } from "react";

/**
 * Viewport size for the full-bleed canvases. Starts at zero on both the server
 * and the client's first render so hydration always agrees, then fills in from
 * the effect on the same frame.
 */
export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}
