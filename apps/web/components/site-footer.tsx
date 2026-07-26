export function SiteFooter() {
  return (
    <a
      className="-translate-x-1/2 fixed bottom-3 left-1/2 z-50 inline-flex items-center gap-2 text-foreground/70 text-sm no-underline"
      href="https://blode.co"
      rel="author"
    >
      Crafted by
      {/** biome-ignore lint/performance/noImgElement: a 20px static avatar does not need the Next image pipeline */}
      <img
        alt="Matthew Blode"
        className="rounded-full"
        height={20}
        src="/react-vello/avatar-sm.png"
        width={20}
      />
      Matthew Blode
    </a>
  );
}
