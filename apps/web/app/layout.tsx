import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl, DEMO_PATH, SITE_ORIGIN } from "@/lib/routes";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "React Vello - Blazing Fast React Renderer Powered by Vello",
    template: "%s | React Vello",
  },
  description:
    "React Vello is a blazing fast React renderer powered by Vello, using WebGPU for high-performance 2D graphics rendering. Build interactive canvas applications with familiar React components.",
  applicationName: "react-vello",
  manifest: "/react-vello/site.webmanifest",
  alternates: { canonical: absoluteUrl(DEMO_PATH) },
  openGraph: {
    type: "website",
    url: absoluteUrl(DEMO_PATH),
    siteName: "React Vello",
    images: [{ url: "/react-vello/opengraph-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/react-vello/opengraph-image.png"],
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
    <html className={`dark ${inter.variable}`} lang="en">
      <head>
        <link href="https://us.i.posthog.com" rel="preconnect" />
        <link href="https://us-assets.i.posthog.com" rel="dns-prefetch" />
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
