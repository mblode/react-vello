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
      about={[
        "The same particle simulation as the other two benchmark pages, drawn by React Konva on a 2D canvas. Same slider from 1,000 to 30,000 particles, same rolling frame rate readout, same simulation code, same trick of mutating nodes through refs so React is not reconciling on every frame.",
        "Canvas 2D is the honest middle of this comparison and, for plenty of real work, the right answer: it runs everywhere, it needs no feature detection, and below a few thousand shapes you will not be able to tell these pages apart. What it cannot do is batch. Every particle is its own fill against the 2D context, issued from the CPU, so the cost tracks the number of shapes rather than the number of pixels they cover. One practical wrinkle: react-konva reaches for window at import time, so this page has to load it with server rendering switched off. Set a particle count here, then open the Vello page and set the same one.",
      ]}
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
