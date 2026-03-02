import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sokone - 底値トラッカー",
  description: "チラシ・Instagram・店頭写真から商品価格をAIで読み取り、底値データを蓄積・可視化",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
