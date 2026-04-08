import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LifeTracker - 生活记录系统",
  description: "一个为考研学生设计的全栈Web应用，集成倒计时、学习计划、时间管理功能",
  keywords: ["生活记录", "学习管理", "番茄钟", "考研", "时间管理"],
  authors: [{ name: "LifeTracker Team" }],
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={notoSansSC.variable}>
      <body className={`${inter.className} font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
