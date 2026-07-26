"use client";

import dynamic from "next/dynamic";

import { StressTestShell } from "@/components/stress-test-shell";

// react-konva reaches for `window` at import time, so it can never run through
// the server render.
const KonvaParticleField = dynamic(
  () =>
    import("@/components/konva-particle-field").then(
      (mod) => mod.KonvaParticleField
    ),
  { ssr: false }
);

export function StressTestReactKonva() {
  return (
    <StressTestShell
      description="Same particle simulation, Konva nodes."
      subtitle="Canvas 2D Scene"
      title="React Konva"
    >
      {({ particleCount, onFps }) => (
        <KonvaParticleField onFps={onFps} particleCount={particleCount} />
      )}
    </StressTestShell>
  );
}
