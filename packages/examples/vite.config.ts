import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const reactVelloEntry = fileURLToPath(
  new URL("../react-vello/src/index.ts", import.meta.url)
);
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/react-vello/",
  build: {
    outDir: "dist/react-vello",
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "react-vello": reactVelloEntry,
    },
  },
});
