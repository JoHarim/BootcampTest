// 모든 페이지를 감싸는 껍데기(레이아웃). 폰트·공통 헤더 자리.
export const metadata = { title: "럭키런 — 긁고, 돌리고, 살아남아라", description: "스크래치 복권과 슬롯머신으로 라운드 목표를 넘겨라. 순수 운빨 도파민 런 게임." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
