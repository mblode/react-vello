"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";

import { useCompare } from "@/components/compare/compare-context";

// react-konva reaches for `window` at import time, so it can never run through
// the server render.
const KonvaParticleField = dynamic(
  () =>
    import("@/components/konva-particle-field").then(
      (mod) => mod.KonvaParticleField
    ),
  { ssr: false }
);

export function KonvaField() {
  const { particleCount, reportFps } = useCompare();
  const onFps = useCallback(
    (fps: number) => reportFps("react-konva", fps),
    [reportFps]
  );

  return <KonvaParticleField onFps={onFps} particleCount={particleCount} />;
}
