import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울 키즈카페 찾기",
  description: "서울형 키즈카페 시설과 예약 가능 시간을 한눈에 확인합니다."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
