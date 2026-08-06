"use client";

import { useEffect, useMemo, useRef } from "react";

import { StressTestShell } from "@/components/stress-test-shell";
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

export function StressTestReactDom() {
  return (
    <StressTestShell
      detail={[
        "This is the control, and it is not a strawman. Elements are created once, colour, size and border radius are set once, and the per-frame work is a transform and an opacity, never top and left or a width.",
        "Two things that look like optimisations are deliberately left out. Writing width and height each frame invalidates layout for every particle, so the pulse rides on the transform instead. And will-change is off: it buys a compositor layer per element, which helps for a handful and exhausts GPU memory at thirty thousand.",
        "It still falls over long before the other two, which is why this slider stops at 12,000 while the other two run to 30,000. Each particle is a real layout object the browser has to style, composite and hit-test, and none of that goes away because you avoided a reflow. Past about 12,000 the main thread is busy for whole seconds at a time: the slider stops responding, so you cannot even drag back down, and the tab is liable to be killed. Set 12,000 here, then set the same on the Vello page.",
      ]}
      label="React DOM"
      maxParticles={PARTICLE_COUNT_MAX_DOM}
      summary="Drawn by the DOM: one absolutely positioned div per particle."
    >
      {({ particleCount, onFps }) => (
        <DomParticleField onFps={onFps} particleCount={particleCount} />
      )}
    </StressTestShell>
  );
}

function DomParticleField({
  particleCount,
  onFps,
}: {
  particleCount: number;
  onFps: (fps: number) => void;
}) {
  const { width, height } = useViewportSize();
  const elementsRef = useRef<Array<HTMLDivElement | null>>([]);
  const readyRef = useRef<boolean[]>([]);
  const particleKeys = useMemo(
    () =>
      Array.from(
        { length: particleCount },
        (_, index) => `dom-particle-${index}`
      ),
    [particleCount]
  );

  useEffect(() => {
    const ready = readyRef.current;
    if (ready.length < particleCount) {
      for (let i = ready.length; i < particleCount; i += 1) {
        ready[i] = false;
      }
    } else if (ready.length > particleCount) {
      ready.length = particleCount;
    }
    elementsRef.current.length = particleCount;
  }, [particleCount]);

  useParticleSimulation({
    width,
    height,
    particleCount,
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
