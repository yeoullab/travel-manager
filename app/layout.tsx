import type { Metadata, Viewport } from "next";
import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/500.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/pretendard/700.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "트레블매니저",
    template: "%s — 트레블매니저",
  },
  description: "커플·소그룹 여행 플래너 PWA",
  applicationName: "트레블매니저",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "트레블매니저",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f1ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-200 text-ink-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
