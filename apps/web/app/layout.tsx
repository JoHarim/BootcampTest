// 모든 페이지를 감싸는 껍데기(레이아웃). 폰트·공통 헤더 자리.
export const metadata = { title: "사주 플래너 — 오늘의 운세", description: "생년월일을 넣으면 오늘의 일진·운세를 보여주는 사주 플래너" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
