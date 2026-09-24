import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "职业导航助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
