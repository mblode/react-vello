"use client";

import { useEffect, useRef } from "react";

export const PARTICLE_COUNT_MIN = 1000;
export const PARTICLE_COUNT_MAX = 30_000;
export const PARTICLE_COUNT_STEP = 500;
export const PARTICLE_COUNT_DEFAULT = 8000;

const MAX_FRAME_DELTA_SECONDS = 0.05;
const FPS_SAMPLE_MS = 500;

export interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  twinkle: number;
  opacity: number;
}

export interface ParticleFrame {
  particles: Particle[];
  timeSeconds: number;
  width: number;
  height: number;
}

interface ParticleSimulationOptions {
  width: number;
  height: number;
  particleCount: number;
  onFps?: (fps: number) => void;
  onFrame?: (frame: ParticleFrame) => void;
}

export function getParticlePulse(timeSeconds: number, twinkle: number): number {
  return 0.6 + 0.4 * Math.sin(timeSeconds * 2 + twinkle);
}

/** The radius each renderer draws this frame, so all three agree on size. */
export function getParticleRadius(particle: Particle, pulse: number): number {
  return particle.size * (0.8 + 0.3 * pulse);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: randomBetween(0.8, 2.6),
    speed: randomBetween(120, 520),
    drift: randomBetween(-35, 35),
    twinkle: randomBetween(0, Math.PI * 2),
    opacity: randomBetween(0.4, 0.85),
  };
}

function resetParticle(particle: Particle, width: number, height: number) {
  particle.x = Math.random() * width;
  particle.y = -randomBetween(0, height * 0.4);
  particle.size = randomBetween(0.8, 2.6);
  particle.speed = randomBetween(120, 520);
  particle.drift = randomBetween(-35, 35);
  particle.twinkle = randomBetween(0, Math.PI * 2);
  particle.opacity = randomBetween(0.4, 0.85);
}

function updateParticle(
  particle: Particle,
  delta: number,
  width: number,
  height: number
) {
  particle.y += particle.speed * delta;
  particle.x += particle.drift * delta;
  if (
    particle.y - particle.size > height + 60 ||
    particle.x < -80 ||
    particle.x > width + 80
  ) {
    resetParticle(particle, width, height);
  }
}

export function useParticleSimulation({
  width,
  height,
  particleCount,
  onFps,
  onFrame,
}: ParticleSimulationOptions) {
  const particlesRef = useRef<Particle[]>([]);
  const boundsRef = useRef({ width, height });
  const onFpsRef = useRef(onFps);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFpsRef.current = onFps;
  }, [onFps]);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    const previous = boundsRef.current;
    if (previous.width > 0 && previous.height > 0) {
      const scaleX = width / previous.width;
      const scaleY = height / previous.height;
      if (Number.isFinite(scaleX) && Number.isFinite(scaleY)) {
        for (const particle of particlesRef.current) {
          particle.x *= scaleX;
          particle.y *= scaleY;
        }
      }
    }
    boundsRef.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    if (width === 0 || height === 0) {
      return;
    }
    const particles = particlesRef.current;
    if (particles.length < particleCount) {
      for (let i = particles.length; i < particleCount; i += 1) {
        particles.push(createParticle(width, height));
      }
    } else if (particles.length > particleCount) {
      particles.length = particleCount;
    }
  }, [particleCount, width, height]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastFps = last;
    let frames = 0;

    const loop = (time: number) => {
      const delta = Math.min(MAX_FRAME_DELTA_SECONDS, (time - last) / 1000);
      last = time;
      const { width: currentWidth, height: currentHeight } = boundsRef.current;
      if (currentWidth > 0 && currentHeight > 0) {
        const particles = particlesRef.current;
        for (const particle of particles) {
          if (!particle) {
            continue;
          }
          updateParticle(particle, delta, currentWidth, currentHeight);
        }
        onFrameRef.current?.({
          particles,
          timeSeconds: time / 1000,
          width: currentWidth,
          height: currentHeight,
        });
      }

      frames += 1;
      if (time - lastFps >= FPS_SAMPLE_MS) {
        const fpsValue = Math.round(frames / ((time - lastFps) / 1000));
        onFpsRef.current?.(fpsValue);
        frames = 0;
        lastFps = time;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return particlesRef;
}
