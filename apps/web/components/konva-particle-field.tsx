"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Circle, Layer, Stage } from "react-konva";

import {
  getParticlePulse,
  getParticleRadius,
  useParticleSimulation,
} from "@/lib/particles";
import { CANVAS_BG, getParticleColor } from "@/lib/scene-colors";
import { useViewportSize } from "@/lib/use-viewport-size";

export function KonvaParticleField({
  particleCount,
  onFps,
}: {
  particleCount: number;
  onFps: (fps: number) => void;
}) {
  const { width, height } = useViewportSize();
  const circleNodesRef = useRef<Array<Konva.Circle | null>>([]);
  const layerRef = useRef<Konva.Layer | null>(null);
  const particleKeys = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, index) => `particle-${index}`),
    [particleCount]
  );

  useEffect(() => {
    circleNodesRef.current.length = particleCount;
  }, [particleCount]);

  useParticleSimulation({
    width,
    height,
    particleCount,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      const nodes = circleNodesRef.current;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) {
          continue;
        }
        const node = nodes[i];
        if (!node) {
          continue;
        }
        const pulse = getParticlePulse(timeSeconds, particle.twinkle);
        node.position({ x: particle.x, y: particle.y });
        node.radius(getParticleRadius(particle, pulse));
        node.opacity(particle.opacity * pulse);
      }
      layerRef.current?.batchDraw();
    },
  });

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: CANVAS_BG }}
    >
      <Stage className="absolute inset-0" height={height} width={width}>
        <Layer listening={false} ref={layerRef}>
          {particleKeys.map((key, index) => (
            <Circle
              fill={getParticleColor(index)}
              key={key}
              listening={false}
              opacity={0}
              perfectDrawEnabled={false}
              radius={1}
              ref={(node) => {
                circleNodesRef.current[index] = node;
              }}
              x={0}
              y={0}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
