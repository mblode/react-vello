import { defineConfig } from "oxlint";

// Generated WASM bindings and the renderer predate Ultracite's strict rules.
export default defineConfig({
  ignorePatterns: ["crates/rvello/pkg/**", "packages/react-vello/src/wasm/**"],
});
