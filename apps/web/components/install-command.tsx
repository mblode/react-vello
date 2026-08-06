import { CopyButton } from "@/components/copy-button";

const COMMAND = "npm i react-vello";

/**
 * The demo's only next step. Without it a visitor who wants the package has
 * nowhere to go but the GitHub link.
 */
export function InstallCommand() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/60 py-1.5 pr-1.5 pl-3">
      <code className="flex-1 truncate font-mono text-xs">{COMMAND}</code>
      <CopyButton label="install command" value={COMMAND} />
    </div>
  );
}
