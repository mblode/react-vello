"use client";

import { useEffect, useMemo, useRef } from "react";

import { StressTestShell } from "@/components/stress-test-shell";
import {
  getParticlePulse,
  getParticleRadius,
  useParticleSimulation,
} from "@/lib/particles";
import { CANVAS_BG, getParticleColor } from "@/lib/scene-colors";
import { useViewportSize } from "@/lib/use-viewport-size";

export function StressTestReactDom() {
  return (
    <StressTestShell
      detail={[
        "This is the control, and it is not a strawman. Elements are created once, colour and border radius are set once, will-change is declared up front, and the per-frame work is a translate3d rather than top and left.",
        "It still falls over long before the other two. Each particle is a real layout object the browser has to style, composite and hit-test, and none of that work goes away because you avoided a reflow.",
      ]}
      label="React DOM"
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
          element.style.willChange = "transform, opacity";
          ready[i] = true;
        }
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        const radius = getParticleRadius(particle, pulse);
        element.style.width = `${radius * 2}px`;
        element.style.height = `${radius * 2}px`;
        element.style.opacity = (particle.opacity * pulse).toFixed(3);
        element.style.transform = `translate3d(${particle.x - radius}px, ${particle.y - radius}px, 0)`;
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
