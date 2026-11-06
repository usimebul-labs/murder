import { GOOGLE_FONTS_URL } from "@mm/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "스튜디오 · 머더 미스터리",
  description: "시나리오 작성 도구",
  robots: { index: false, follow: false },
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
