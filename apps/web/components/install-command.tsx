"use client";

import { CheckIcon, CopyIcon } from "blode-icons-react";
import { useEffect, useState } from "react";

const COMMAND = "npm i react-vello";

/**
 * The demo's only next step. Without it a visitor who wants the package has
 * nowhere to go but the GitHub link.
 */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/60 py-1.5 pr-1.5 pl-3">
      <code className="flex-1 truncate font-mono text-xs">{COMMAND}</code>
      <button
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        onClick={() => {
          navigator.clipboard
            .writeText(COMMAND)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
        <span className="sr-only">
          {copied ? "Command copied" : "Copy install command"}
        </span>
      </button>
    </div>
  );
}
