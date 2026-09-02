import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울형 키즈카페 예약 도우미",
  description: "시설과 이용 시간을 한 번만 선택하고 가능한 예약 회차를 확인합니다.",
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
