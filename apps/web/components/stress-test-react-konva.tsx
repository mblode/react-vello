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
      detail={[
        "Canvas 2D runs everywhere and needs no feature detection. Below a few thousand shapes you will not be able to tell these pages apart.",
        "What it cannot do is batch. Every particle is its own fill against the 2D context, issued from the CPU, so cost tracks the number of shapes rather than the pixels they cover. Set a count here, then open the Vello page and set the same one.",
      ]}
      label="React Konva"
      summary="The shared particle simulation, drawn by Konva on a 2D canvas."
    >
      {({ particleCount, onFps }) => (
        <KonvaParticleField onFps={onFps} particleCount={particleCount} />
      )}
    </StressTestShell>
  );
}
