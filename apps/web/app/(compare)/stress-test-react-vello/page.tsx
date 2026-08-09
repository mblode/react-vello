import { VelloField } from "@/components/compare/vello-field";
import { pageMetadata } from "@/lib/metadata";
import { STRESS_TEST_REACT_VELLO_PATH } from "@/lib/routes";

export const metadata = pageMetadata({
  title: "Stress test: 30,000 particles on WebGPU",
  description:
    "Push the React Vello renderer to 30,000 animated particles and watch the frame rate. The scene graph is encoded in Rust and drawn on the GPU by Vello.",
  path: STRESS_TEST_REACT_VELLO_PATH,
});

export default function StressTestReactVelloPage() {
  return <VelloField />;
}
