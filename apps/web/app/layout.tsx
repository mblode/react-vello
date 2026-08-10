import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/metadata";
import { absoluteUrl, DEMO_PATH } from "@/lib/routes";

import "./globals.css";

const glide = localFont({
  src: [
    { path: "./fonts/glide-variable.woff2", style: "normal" },
    { path: "./fonts/glide-variable-italic.woff2", style: "italic" },
  ],
  variable: "--font-glide",
  weight: "100 950",
  display: "swap",
});

const glideMono = localFont({
  src: "./fonts/glide-mono.woff2",
  variable: "--font-glide-mono",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  // The zone URL, not the bare origin (Rule 11). Only correct because the card
  // is a generated `opengraph-image.tsx` route: Next does not prefix those with
  // `basePath`, so `metadataBase` supplies the prefix exactly once. Against the
  // static PNG this replaced, the two would have stacked into
  // `/react-vello/react-vello/…`.
  metadataBase: new URL(absoluteUrl(DEMO_PATH)),
  // "Product: what it does", colon and not a hyphen, under 60 characters so the
  // SERP does not truncate it. Rule 8 of
  // blode-co/apps/web/.claude/knowledge/zone-conventions.md.
  title: {
    default: "React Vello: a React renderer for Vello and WebGPU",
    template: "%s | React Vello",
  },
  description:
    "Write 2D scenes as React components and draw them on the GPU. A custom reconciler turns the React tree into a Vello scene graph, rendered through WebGPU.",
  // Person-level attribution as metadata, not only as footer HTML and JSON-LD.
  authors: [{ name: "Matthew Blode", url: "https://blode.co" }],
  creator: "Matthew Blode",
  applicationName: "react-vello",
  manifest: "/react-vello/site.webmanifest",
  alternates: { canonical: absoluteUrl(DEMO_PATH) },
  // No `images` here: `app/opengraph-image.tsx` is the card. Next reuses it for
  // `twitter:image` too when there is no `twitter-image` file.
  openGraph: {
    type: "website",
    url: absoluteUrl(DEMO_PATH),
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@mattblode",
  },
  icons: {
    icon: [
      { url: "/react-vello/favicon.svg", type: "image/svg+xml" },
      {
        url: "/react-vello/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
    ],
    shortcut: "/react-vello/favicon.ico",
    apple: "/react-vello/apple-touch-icon.png",
  },
  appleWebApp: { title: "react-vello" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`dark ${glide.variable} ${glideMono.variable}`} lang="en">
      <head>
        <link href={process.env.NEXT_PUBLIC_POSTHOG_HOST} rel="preconnect" />
      </head>
      {/* No height or overflow here. The demo scrolls; the benchmark routes
          pin themselves to the viewport in their own layout. */}
      <body className="bg-background">
        {children}
        <SiteHeader />
      </body>
    </html>
  );
}
