"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Canvas,
  type CanvasContext,
  Group,
  type NodeRef,
  Rect,
  type RectProps,
} from "react-vello";

import { StressTestShell } from "@/components/stress-test-shell";
import { VelloSurface, type VelloScene } from "@/components/vello-surface";
import {
  getParticleColor,
  getParticlePulse,
  STRESS_BG,
  useParticleSimulation,
} from "@/lib/particles";

type MutableRectNode = NodeRef & { props: RectProps };

export function StressTestReactVello() {
  return (
    <StressTestShell
      description="Same particle simulation, Vello renderer."
      subtitle="WebGPU Scene Graph"
      title="React Vello"
    >
      {({ particleCount, onFps }) => (
        <VelloParticles onFps={onFps} particleCount={particleCount} />
      )}
    </StressTestShell>
  );
}

function VelloParticles({
  particleCount,
  onFps,
}: {
  particleCount: number;
  onFps: (fps: number) => void;
}) {
  const scene = useCallback(
    ({ width, height, context }: VelloScene) => (
      <VelloParticleField
        context={context}
        height={height}
        onFps={onFps}
        particleCount={particleCount}
        width={width}
      />
    ),
    [particleCount, onFps]
  );

  return <VelloSurface scene={scene} />;
}

interface VelloParticleFieldProps {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
  context?: CanvasContext;
}

function VelloParticleField({
  width,
  height,
  particleCount,
  onFps,
  context,
}: VelloParticleFieldProps) {
  const nodeRefs = useRef<Array<MutableRectNode | null>>([]);
  const particleKeys = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, index) => `particle-${index}`),
    [particleCount]
  );
  const contextRef = useRef<CanvasContext | null>(context ?? null);

  useEffect(() => {
    nodeRefs.current.length = particleCount;
  }, [particleCount]);

  useEffect(() => {
    contextRef.current = context ?? null;
  }, [context]);

  useParticleSimulation({
    width,
    height,
    particleCount,
    onFps,
    onFrame: ({ particles, timeSeconds }) => {
      // Mutate scene node props directly to avoid per-frame React reconciliation.
      const nodes = nodeRefs.current;
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
        const radius = particle.size * (0.8 + 0.3 * pulse);
        const props = node.props;
        const origin = props.origin as [number, number] | undefined;
        const size = props.size as [number, number] | undefined;
        if (origin) {
          origin[0] = particle.x - radius;
          origin[1] = particle.y - radius;
        }
        if (size) {
          size[0] = radius * 2;
          size[1] = radius * 2;
        }
        props.opacity = particle.opacity * pulse;
      }
      contextRef.current?.requestFrame();
    },
  });

  return (
    <Canvas backgroundColor={STRESS_BG} height={height} width={width}>
      <Group listening={false}>
        {particleKeys.map((key, index) => (
          <Rect
            fill={{ kind: "solid", color: getParticleColor(index) }}
            key={key}
            opacity={0}
            origin={[0, 0]}
            radius={999}
            ref={(node: NodeRef | null) => {
              nodeRefs.current[index] = node as MutableRectNode | null;
            }}
            size={[1, 1]}
          />
        ))}
      </Group>
    </Canvas>
  );
}
