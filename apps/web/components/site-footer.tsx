import { BASE_PATH } from "@/lib/routes";

const AUTHOR_URL = "https://blode.co";

/** biome-ignore lint/performance/noImgElement: a 20px static avatar does not need the Next image pipeline */
const Avatar = () => (
  <img
    alt=""
    className="rounded-full"
    height={20}
    src={`${BASE_PATH}/avatar-sm.png`}
    width={20}
  />
);

/**
 * Two shapes for two kinds of page. The benchmark routes are a pinned canvas
 * with nowhere to put a footer, so there the credit is a badge floated into the
 * corner; the demo scrolls, so there it is an ordinary footer at the end of the
 * document.
 */
export function SiteFooter({ floating = false }: { floating?: boolean }) {
  if (floating) {
    return (
      <a
        className="absolute right-4 bottom-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-card/85 py-1 pr-3 pl-1 text-muted-foreground text-xs no-underline backdrop-blur-md transition-colors hover:text-foreground"
        href={AUTHOR_URL}
        rel="author"
      >
        <Avatar />
        Crafted by Matthew Blode
      </a>
    );
  }

  return (
    <footer className="full-bleed-bg relative z-3 flex flex-col items-center justify-center gap-2 pt-16 pb-[calc(2rem+env(safe-area-inset-bottom))] text-muted-foreground text-sm">
      <div className="flex items-center gap-1">
        Crafted by
        <a
          className="flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 no-underline transition-colors hover:text-foreground"
          href={AUTHOR_URL}
          rel="author"
        >
          <Avatar />
          Matthew Blode
        </a>
      </div>
    </footer>
  );
}
