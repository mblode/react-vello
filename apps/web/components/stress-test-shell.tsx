"use client";

import { type ReactNode, useCallback, useState } from "react";

import { InfoPanel } from "@/components/info-panel";
import { Slider } from "@/components/ui/slider";
import {
  PARTICLE_COUNT_DEFAULT,
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  PARTICLE_COUNT_STEP,
} from "@/lib/particles";
import { clamp } from "@/lib/utils";

/** Stated here rather than repeated on all three benchmark pages. */
const BENCHMARK_BASIS =
  "All three pages run the same simulation and the same controls. The only variable is the renderer.";

/**
 * Owns the particle count and FPS readout shared by all three benchmarks, so
 * each renderer only has to supply its own view of the same simulation.
 */
export function StressTestShell({
  label,
  summary,
  detail,
  children,
}: {
  label: string;
  summary: string;
  detail: readonly string[];
  children: (args: {
    particleCount: number;
    onFps: (fps: number) => void;
  }) => ReactNode;
}) {
  const [particleCount, setParticleCount] = useState(PARTICLE_COUNT_DEFAULT);
  // null until the first sample lands. A `0` sentinel would be indistinguishable
  // from a real reading of 0, which is exactly what a heavily throttled tab
  // reports — the one case where the number matters most.
  const [fps, setFps] = useState<number | null>(null);

  const onFps = useCallback((value: number) => setFps(value), []);

  return (
    <>
      {children({ particleCount, onFps })}
      <InfoPanel
        detail={[BENCHMARK_BASIS, ...detail]}
        label={label}
        summary={summary}
      >
        <dl className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground text-xs">Particles</dt>
            <dd className="font-mono text-sm tabular-nums">
              {particleCount.toLocaleString()}
            </dd>
          </div>
          <Slider
            aria-label="Particle count"
            max={PARTICLE_COUNT_MAX}
            min={PARTICLE_COUNT_MIN}
            onValueChange={(value) => {
              if (typeof value[0] === "number") {
                setParticleCount(
                  clamp(value[0], PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX)
                );
              }
            }}
            step={PARTICLE_COUNT_STEP}
            value={[particleCount]}
          />
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground text-xs">Frames per second</dt>
            <dd className="font-mono text-lg tabular-nums">{fps ?? "--"}</dd>
          </div>
        </dl>
      </InfoPanel>
    </>
  );
}
