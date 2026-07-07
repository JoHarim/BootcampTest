// /rpg 라우트의 제목·설명 (page.tsx가 클라이언트 컴포넌트라 metadata는 여기서)
export const metadata = {
  title: "사주 RPG — 내 사주로 싸우는 오행 던전",
  description: "생년월일이 능력치가 되는 오행 상성 미니 RPG — 던전 5종을 정복하세요",
};

export default function RpgLayout({ children }: { children: React.ReactNode }) {
  return children;
}
