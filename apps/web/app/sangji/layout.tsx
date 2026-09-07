// /sangji — 상지인터내셔날 홈페이지 리뉴얼 시안. 이 아래 모든 화면이 같은 헤더·푸터·스타일을 쓴다.
import "./sangji.css";

export const metadata = {
  title: "상지인터내셔날 — NOK 한국 공식 대리점 | 리뉴얼 시안",
  description: "패킹·오일씰·O-Ring·타이밍벨트. 품번·규격 검색, 온라인 견적, 산업별 솔루션. 홈페이지 리뉴얼 시안.",
};

export default function SangjiLayout({ children }: { children: React.ReactNode }) {
  return <div className="sj">{children}</div>;
}
