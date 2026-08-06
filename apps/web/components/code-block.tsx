import { CopyButton } from "@/components/copy-button";
import { highlightTsx } from "@/lib/highlight";

/**
 * Highlighted at build time, so no grammar, theme or highlighter reaches the
 * browser — the served HTML is already coloured spans.
 */
export async function CodeBlock({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const html = await highlightTsx(code);

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-border bg-card/60">
      <figcaption className="flex items-center gap-2 border-border border-b px-3 py-2">
        <span className="flex-1 truncate font-mono text-muted-foreground text-xs">
          {filename}
        </span>
        <CopyButton label="code sample" value={code} />
      </figcaption>
      {/* Shiki emits its own <pre><code> with inline colours; the sizing and
          scroll behaviour are ours. */}
      <div
        className="overflow-x-auto p-4 font-mono text-[0.8125rem]/[1.7] [&_pre]:bg-transparent!"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time Shiki output from a string literal in this repo
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
