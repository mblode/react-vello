import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { OG_IMAGE, SITE_NAME } from "@/lib/metadata";
import { absoluteUrl, DEMO_PATH, SITE_ORIGIN } from "@/lib/routes";

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
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "React Vello - Blazing Fast React Renderer Powered by Vello",
    template: "%s | React Vello",
  },
  description:
    "A React renderer powered by Vello and WebGPU. Build interactive 2D canvas scenes with familiar React components, drawn on the GPU.",
  applicationName: "react-vello",
  manifest: "/react-vello/site.webmanifest",
  alternates: { canonical: absoluteUrl(DEMO_PATH) },
  openGraph: {
    type: "website",
    url: absoluteUrl(DEMO_PATH),
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE],
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
      <body className="h-full overflow-hidden">
        <div className="relative h-full w-full overflow-hidden bg-background">
          {children}
          <SiteHeader />
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
