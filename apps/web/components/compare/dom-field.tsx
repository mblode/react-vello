"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useCompare } from "@/components/compare/compare-context";
import {
  getParticlePulse,
  getParticleRadius,
  PARTICLE_COUNT_MAX_DOM,
  useParticleSimulation,
} from "@/lib/particles";
import { CANVAS_BG, getParticleColor } from "@/lib/scene-colors";
import { useViewportSize } from "@/lib/use-viewport-size";

/** Fixed box every particle is drawn in; the per-frame pulse scales it. */
const DOT_BASE_PX = 8;
const DOT_HALF_PX = DOT_BASE_PX / 2;

export function DomField() {
  const { particleCount, reportFps } = useCompare();
  const onFps = useCallback(
    (fps: number) => reportFps("react-dom", fps),
    [reportFps]
  );
  // The shared count can exceed what this renderer survives. It draws its
  // ceiling and the results table says so, rather than hanging the tab.
  const count = Math.min(particleCount, PARTICLE_COUNT_MAX_DOM);

  const { width, height } = useViewportSize();
  const elementsRef = useRef<Array<HTMLDivElement | null>>([]);
  const readyRef = useRef<boolean[]>([]);
  const particleKeys = useMemo(
    () => Array.from({ length: count }, (_, index) => `dom-particle-${index}`),
    [count]
  );

  useEffect(() => {
    const ready = readyRef.current;
    if (ready.length < count) {
      for (let i = ready.length; i < count; i += 1) {
        ready[i] = false;
      }
    } else if (ready.length > count) {
      ready.length = count;
    }
    elementsRef.current.length = count;
  }, [count]);

  useParticleSimulation({
    width,
    height,
    particleCount: count,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      const elements = elementsRef.current;
      const ready = readyRef.current;

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) {
          continue;
        }
        const element = elements[i];
        if (!element) {
          continue;
        }
        if (!ready[i]) {
          element.style.backgroundColor = getParticleColor(i);
          element.style.borderRadius = "999px";
          // No will-change. It buys a compositor layer per element, which is a
          // win for a handful of them and a way to exhaust GPU memory at
          // 30,000 — enough to get the renderer killed outright.
          // Size is set once. Writing width/height per frame would invalidate
          // layout for every particle on every frame, which is a worse sin than
          // the top/left this control is written to avoid; the pulse rides on
          // the transform instead, where it stays on the compositor.
          element.style.width = `${DOT_BASE_PX}px`;
          element.style.height = `${DOT_BASE_PX}px`;
          ready[i] = true;
        }
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        const scale = (getParticleRadius(particle, pulse) * 2) / DOT_BASE_PX;
        element.style.opacity = (particle.opacity * pulse).toFixed(3);
        // Scales about the element's centre, so the offset is a constant.
        element.style.transform = `translate3d(${particle.x - DOT_HALF_PX}px, ${particle.y - DOT_HALF_PX}px, 0) scale(${scale.toFixed(3)})`;
      }
    },
  });

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: CANVAS_BG }}
    >
      {particleKeys.map((key, index) => (
        <div
          className="absolute"
          key={key}
          ref={(element) => {
            elementsRef.current[index] = element;
          }}
        />
      ))}
    </div>
  );
}
