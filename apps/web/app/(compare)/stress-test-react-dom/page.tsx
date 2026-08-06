import { DomField } from "@/components/compare/dom-field";
import { pageMetadata } from "@/lib/metadata";
import { STRESS_TEST_REACT_DOM_PATH } from "@/lib/routes";

export const metadata = pageMetadata({
  title: "React DOM Stress Test - Particle Benchmark",
  description:
    "The same particle simulation running on plain React DOM elements, showing where the DOM stops keeping up with canvas and GPU renderers.",
  path: STRESS_TEST_REACT_DOM_PATH,
});

export default function StressTestReactDomPage() {
  return <DomField />;
}
