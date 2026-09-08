import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "아이랑 서울 · 키즈카페 예약 도우미",
  description: "가족이 원하는 키즈카페와 시간을 차분하게 확인하는 예약 도우미입니다.",
  icons: {
    icon: "/seoul-kids-app-icon-v2.png",
    apple: "/seoul-kids-app-icon-v2.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
