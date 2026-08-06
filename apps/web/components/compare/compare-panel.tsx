"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCompare } from "@/components/compare/compare-context";
import { InfoPanel } from "@/components/info-panel";
import { Slider } from "@/components/ui/slider";
import {
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  PARTICLE_COUNT_STEP,
} from "@/lib/particles";
import { type RendererMeta, RENDERERS } from "@/lib/renderers";
import { clamp, cn } from "@/lib/utils";

const BENCHMARK_BASIS =
  "Every renderer runs the same simulation and the same controls, one at a time. Running them together would make them fight over one main thread, and every number would be wrong.";

/** What a row can say. Each is a state the table has to be able to reach. */
type RowState =
  | { kind: "unsupported" }
  | { kind: "capped"; at: number }
  | { kind: "measuring" }
  | { kind: "unmeasured" }
  | { kind: "stale"; fps: number }
  | { kind: "current"; fps: number };

export function ComparePanel({ active }: { active: RendererMeta }) {
  const {
    particleCount,
    sliderCount,
    setSliderCount,
    commitCount,
    results,
    isComparable,
  } = useCompare();
  const hasWebGPU = useWebGPUSupport();

  const rowState = (renderer: RendererMeta): RowState => {
    if (renderer.requiresWebGPU && hasWebGPU === false) {
      return { kind: "unsupported" };
    }
    if (particleCount > renderer.maxParticles) {
      return { kind: "capped", at: renderer.maxParticles };
    }
    const result = results[renderer.id];
    if (!result) {
      return renderer.id === active.id
        ? { kind: "measuring" }
        : { kind: "unmeasured" };
    }
    return isComparable(result)
      ? { kind: "current", fps: result.fps }
      : { kind: "stale", fps: result.fps };
  };

  return (
    <InfoPanel
      // Sits above the credit badge on a phone, beside it from `sm` up.
      className="absolute bottom-16 left-4 z-10 w-[min(22rem,calc(100vw-2rem))] sm:bottom-4"
      detail={[BENCHMARK_BASIS, ...active.detail]}
      label={active.name}
      summary={active.summary}
    >
      <nav
        aria-label="Renderer"
        className="mt-4 flex gap-1 rounded-full bg-muted/60 p-1"
      >
        {RENDERERS.map((renderer) => (
          <Link
            aria-current={renderer.id === active.id ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full px-2 py-1 text-center text-xs no-underline transition-colors",
              renderer.id === active.id
                ? "bg-background font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            href={renderer.path}
            key={renderer.id}
          >
            {renderer.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">Particles</span>
        <span className="font-mono text-sm tabular-nums">
          {sliderCount.toLocaleString()}
        </span>
      </div>
      <Slider
        aria-label="Particle count"
        className="mt-2"
        max={PARTICLE_COUNT_MAX}
        min={PARTICLE_COUNT_MIN}
        onValueChange={(value) => {
          if (typeof value[0] === "number") {
            setSliderCount(
              clamp(value[0], PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX)
            );
          }
        }}
        onValueCommitted={(value) => {
          if (typeof value[0] === "number") {
            commitCount(
              clamp(value[0], PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX)
            );
          }
        }}
        step={PARTICLE_COUNT_STEP}
        value={[sliderCount]}
      />

      <dl className="mt-4 space-y-2 border-border border-t pt-3">
        {RENDERERS.map((renderer) => (
          <div
            className="flex items-baseline justify-between gap-3"
            key={renderer.id}
          >
            <dt
              className={cn(
                "text-xs",
                renderer.id === active.id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {renderer.label}
            </dt>
            <dd className="text-right">
              <ResultValue state={rowState(renderer)} />
            </dd>
          </div>
        ))}
      </dl>
    </InfoPanel>
  );
}

function ResultValue({ state }: { state: RowState }) {
  if (state.kind === "unsupported") {
    return <span className="text-muted-foreground text-xs">Needs WebGPU</span>;
  }
  if (state.kind === "capped") {
    return (
      <span className="text-muted-foreground text-xs">
        Stops at {state.at.toLocaleString()}
      </span>
    );
  }
  if (state.kind === "measuring") {
    return <span className="text-muted-foreground text-xs">Measuring…</span>;
  }
  if (state.kind === "unmeasured") {
    return <span className="text-muted-foreground text-xs">Not run yet</span>;
  }
  return (
    <>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          state.kind === "stale" && "text-muted-foreground"
        )}
      >
        {state.fps}
      </span>
      {state.kind === "stale" && (
        <span className="ml-1 text-[0.6875rem] text-muted-foreground">
          needs re-run
        </span>
      )}
    </>
  );
}

/** Null until the client answers, so the server and first render agree. */
function useWebGPUSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "gpu" in navigator);
  }, []);
  return supported;
}
