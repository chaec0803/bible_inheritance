import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '말씀유산 · 성경 녹음 프로토타입',
  description: '소중한 사람의 목소리로 성경을 구절별 녹음하는 말씀유산 UI 프로토타입',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
