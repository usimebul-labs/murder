import { GOOGLE_FONTS_URL } from "@mm/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "머더 미스터리",
  description: "4~8인이 실시간으로 접속해 범인을 찾는 온라인 머더 미스터리",
  appleWebApp: { capable: true, title: "머더 미스터리", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1c1916",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
