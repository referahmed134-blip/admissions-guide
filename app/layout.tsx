import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "升学指南 · 考研与高考择校查询",
  description: "按学校与专业代码查询官方历史分数线、报录比和招生资讯，支持考研、高考两个入口，标明来源与更新状态。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
