import { BASE_PATH } from "@/lib/routes";

export function SiteFooter() {
  return (
    <a
      className="absolute right-4 bottom-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-card/85 py-1 pr-3 pl-1 text-muted-foreground text-xs no-underline backdrop-blur-md transition-colors hover:text-foreground"
      href="https://blode.co"
      rel="author"
    >
      {/** biome-ignore lint/performance/noImgElement: a 20px static avatar does not need the Next image pipeline */}
      <img
        alt=""
        className="rounded-full"
        height={20}
        src={`${BASE_PATH}/avatar-sm.png`}
        width={20}
      />
      Crafted by Matthew Blode
    </a>
  );
}
