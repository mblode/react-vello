"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { PARTICLE_COUNT_DEFAULT } from "@/lib/particles";
import type { RendererId } from "@/lib/renderers";
import { useViewportSize } from "@/lib/use-viewport-size";

/**
 * A frame rate only means something alongside the conditions it was measured
 * under. Recording those with it is what lets the table tell a comparable
 * result from one that merely looks current.
 */
interface Measurement {
  fps: number;
  particleCount: number;
  width: number;
  height: number;
}

interface CompareValue {
  /** Committed count, drives the running renderer. */
  particleCount: number;
  /** Live count, tracks the slider thumb. */
  sliderCount: number;
  setSliderCount: (value: number) => void;
  commitCount: (value: number) => void;
  results: Partial<Record<RendererId, Measurement>>;
  reportFps: (id: RendererId, fps: number) => void;
  /** True when a stored result was captured under today's conditions. */
  isComparable: (measurement: Measurement) => boolean;
}

const CompareContext = createContext<CompareValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [sliderCount, setSliderCount] = useState(PARTICLE_COUNT_DEFAULT);
  const [particleCount, setParticleCount] = useState(PARTICLE_COUNT_DEFAULT);
  const [results, setResults] = useState<
    Partial<Record<RendererId, Measurement>>
  >({});
  const { width, height } = useViewportSize();

  const reportFps = useCallback(
    (id: RendererId, fps: number) => {
      setResults((prev) => ({
        ...prev,
        [id]: { fps, particleCount, width, height },
      }));
    },
    [particleCount, width, height]
  );

  const isComparable = useCallback(
    (measurement: Measurement) =>
      measurement.particleCount === particleCount &&
      measurement.width === width &&
      measurement.height === height,
    [particleCount, width, height]
  );

  const value = useMemo(
    () => ({
      particleCount,
      sliderCount,
      setSliderCount,
      commitCount: setParticleCount,
      results,
      reportFps,
      isComparable,
    }),
    [particleCount, sliderCount, results, reportFps, isComparable]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare(): CompareValue {
  const value = useContext(CompareContext);
  if (!value) {
    throw new Error("useCompare must be used inside a CompareProvider");
  }
  return value;
}
