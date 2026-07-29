"use client";

import { type ReactNode, useCallback, useState } from "react";

import { ParticleStressHud } from "@/components/particle-stress-hud";
import {
  clamp,
  PARTICLE_COUNT_DEFAULT,
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
} from "@/lib/particles";

interface StressTestShellProps {
  title: string;
  subtitle: string;
  description: string;
  /** Prose for the HUD. See `AboutPanel` for why it lives in the overlay. */
  about: readonly string[];
  children: (args: {
    particleCount: number;
    onFps: (fps: number) => void;
  }) => ReactNode;
}

/**
 * Owns the particle count and FPS readout shared by all three benchmarks, so
 * each renderer only has to supply its own view of the same simulation.
 */
export function StressTestShell({
  title,
  subtitle,
  description,
  about,
  children,
}: StressTestShellProps) {
  const [particleCount, setParticleCount] = useState(PARTICLE_COUNT_DEFAULT);
  const [fps, setFps] = useState(0);

  const handleCountChange = (value: number) => {
    setParticleCount(clamp(value, PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX));
  };

  const onFps = useCallback((value: number) => setFps(value), []);

  return (
    <>
      {children({ particleCount, onFps })}
      <ParticleStressHud
        about={about}
        count={particleCount}
        countLabel="Particles"
        description={description}
        fps={fps}
        onCountChange={handleCountChange}
        subtitle={subtitle}
        title={title}
      />
    </>
  );
}
