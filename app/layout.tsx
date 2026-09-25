import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "就业服务智能体",
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
