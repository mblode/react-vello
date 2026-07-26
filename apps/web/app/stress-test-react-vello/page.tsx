import type { Metadata } from "next";

import { StressTestReactVello } from "@/components/stress-test-react-vello";
import { absoluteUrl, STRESS_TEST_REACT_VELLO_PATH } from "@/lib/routes";

const title = "React Vello Stress Test - 30,000 Particles on WebGPU";
const description =
  "Push the React Vello renderer to 30,000 animated particles and watch the frame rate. The scene graph is encoded in Rust and drawn on the GPU through Vello and WebGPU.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: absoluteUrl(STRESS_TEST_REACT_VELLO_PATH) },
  openGraph: {
    title,
    description,
    url: absoluteUrl(STRESS_TEST_REACT_VELLO_PATH),
  },
  twitter: { title, description },
};

export default function StressTestReactVelloPage() {
  return <StressTestReactVello />;
}
