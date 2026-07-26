import type { Metadata } from "next";

import { StressTestReactKonva } from "@/components/stress-test-react-konva";
import { absoluteUrl, STRESS_TEST_REACT_KONVA_PATH } from "@/lib/routes";

const title = "React Konva Stress Test - Canvas 2D Particle Benchmark";
const description =
  "The same particle simulation running on React Konva's Canvas 2D renderer, so you can compare its frame rate against the WebGPU-backed React Vello renderer.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: absoluteUrl(STRESS_TEST_REACT_KONVA_PATH) },
  openGraph: {
    title,
    description,
    url: absoluteUrl(STRESS_TEST_REACT_KONVA_PATH),
  },
  twitter: { title, description },
};

export default function StressTestReactKonvaPage() {
  return <StressTestReactKonva />;
}
