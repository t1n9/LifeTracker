import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'LifeTracker - 生活记录系统',
  description: '一个为考研学生设计的全栈 Web 应用，集成学习计划、时间管理与生活记录功能。',
  keywords: ['生活记录', '学习管理', '番茄钟', '考研', '时间管理'],
  authors: [{ name: 'LifeTracker Team' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
