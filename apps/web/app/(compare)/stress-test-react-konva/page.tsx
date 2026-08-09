import { KonvaField } from "@/components/compare/konva-field";
import { pageMetadata } from "@/lib/metadata";
import { STRESS_TEST_REACT_KONVA_PATH } from "@/lib/routes";

export const metadata = pageMetadata({
  title: "React Konva stress test",
  description:
    "The same particle simulation running on React Konva's Canvas 2D renderer, so you can compare its frame rate against the WebGPU-backed React Vello renderer.",
  path: STRESS_TEST_REACT_KONVA_PATH,
});

export default function StressTestReactKonvaPage() {
  return <KonvaField />;
}
