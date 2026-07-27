import { StressTestReactKonva } from "@/components/stress-test-react-konva";
import { pageMetadata } from "@/lib/metadata";
import { STRESS_TEST_REACT_KONVA_PATH } from "@/lib/routes";

export const metadata = pageMetadata({
  title: "React Konva Stress Test - Canvas 2D Particle Benchmark",
  description:
    "The same particle simulation running on React Konva's Canvas 2D renderer, so you can compare its frame rate against the WebGPU-backed React Vello renderer.",
  path: STRESS_TEST_REACT_KONVA_PATH,
});

export default function StressTestReactKonvaPage() {
  return <StressTestReactKonva />;
}
