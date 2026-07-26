import type { Metadata } from "next";

import { StressTestReactDom } from "@/components/stress-test-react-dom";
import { absoluteUrl, STRESS_TEST_REACT_DOM_PATH } from "@/lib/routes";

const title = "React DOM Stress Test - Particle Benchmark";
const description =
  "The same particle simulation running on plain React DOM elements, showing where the DOM stops keeping up with canvas and GPU renderers.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: absoluteUrl(STRESS_TEST_REACT_DOM_PATH) },
  openGraph: {
    title,
    description,
    url: absoluteUrl(STRESS_TEST_REACT_DOM_PATH),
  },
  twitter: { title, description },
};

export default function StressTestReactDomPage() {
  return <StressTestReactDom />;
}
