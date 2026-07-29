"use client";

import { AboutPanel } from "@/components/about-panel";
import { Slider } from "@/components/ui/slider";
import {
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  PARTICLE_COUNT_STEP,
} from "@/lib/particles";

interface ParticleStressHudProps {
  title: string;
  subtitle: string;
  description: string;
  about: readonly string[];
  countLabel: string;
  count: number;
  fps: number;
  onCountChange: (value: number) => void;
}

export function ParticleStressHud({
  title,
  subtitle,
  description,
  about,
  countLabel,
  count,
  fps,
  onCountChange,
}: ParticleStressHudProps) {
  const formattedCount = count.toLocaleString();
  const fpsLabel = fps > 0 ? fps.toString() : "--";

  return (
    <div className="absolute bottom-4 left-4 z-10 max-h-[min(560px,calc(100dvh-8rem))] w-[min(380px,92vw)] overflow-y-auto rounded-xl border border-border/60 bg-card/90 p-4 text-foreground text-sm shadow-xl backdrop-blur">
      <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
        {title}
      </div>
      <div className="mt-2 font-semibold text-lg">{subtitle}</div>
      <div className="mt-1 text-muted-foreground text-xs">{description}</div>
      <div className="mt-4 rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-wide">
          <span>{countLabel}</span>
          <span className="font-semibold text-foreground text-sm">
            {formattedCount}
          </span>
        </div>
        <Slider
          aria-label="Particle count"
          className="mt-2"
          max={PARTICLE_COUNT_MAX}
          min={PARTICLE_COUNT_MIN}
          onValueChange={(value) => {
            if (typeof value[0] === "number") {
              onCountChange(value[0]);
            }
          }}
          step={PARTICLE_COUNT_STEP}
          value={[count]}
        />
        <div className="mt-2 text-[11px] text-muted-foreground">
          More particles push fill-rate and blending.
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            FPS
          </div>
          <div className="mt-1 font-semibold text-lg">{fpsLabel}</div>
          <div className="text-[10px] text-muted-foreground">avg</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {countLabel}
          </div>
          <div className="mt-1 font-semibold text-lg">{formattedCount}</div>
          <div className="text-[10px] text-muted-foreground">active</div>
        </div>
      </div>
      <AboutPanel
        className="mt-4 border-border/60 border-t pt-4"
        paragraphs={about}
      />
    </div>
  );
}
