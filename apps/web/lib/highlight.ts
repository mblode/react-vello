import { createHighlighterCore, type ThemeRegistration } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { HANDLE_COLOR, SCENE_INK } from "@/lib/scene-colors";

/**
 * The snippet reads as part of the same picture as the canvas above it: the
 * anchor blue names things, the control violet is for the values you would
 * change. Written out rather than pulling a stock theme so the two palettes
 * cannot drift, and so no theme bundle ships for a single fixed block.
 */
const THEME: ThemeRegistration = {
  name: "react-vello",
  type: "dark",
  // Transparent so the block sits on whatever surface wraps it.
  bg: "transparent",
  fg: "#d4d4d8",
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { fontStyle: "italic", foreground: "#71717a" },
    },
    {
      scope: [
        "keyword",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.expression",
      ],
      settings: { foreground: HANDLE_COLOR.control },
    },
    {
      scope: ["entity.name.tag", "support.class.component"],
      settings: { foreground: HANDLE_COLOR.anchor },
    },
    {
      scope: ["entity.other.attribute-name", "meta.object-literal.key"],
      settings: { foreground: "#d4d4d8" },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string"],
      settings: { foreground: "#9ed7a4" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#f0b866" },
    },
    {
      scope: ["variable", "variable.other.readwrite", "support.variable"],
      settings: { foreground: SCENE_INK.tracer },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: HANDLE_COLOR.anchor },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "meta.embedded.expression punctuation",
      ],
      settings: { foreground: "#71717a" },
    },
  ],
};

// One highlighter for the whole build. Without the module-level promise every
// block would spin up its own grammar registry.
const highlighter = createHighlighterCore({
  themes: [THEME],
  langs: [import("@shikijs/langs/tsx")],
  // The JavaScript engine keeps the oniguruma WASM binary out of the build.
  engine: createJavaScriptRegexEngine(),
});

export async function highlightTsx(code: string): Promise<string> {
  return (await highlighter).codeToHtml(code, {
    lang: "tsx",
    theme: THEME.name ?? "react-vello",
  });
}
