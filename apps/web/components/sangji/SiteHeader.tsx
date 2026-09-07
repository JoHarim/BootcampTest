// 리뉴얼 시안 공통 머리(헤더). 위 얇은 띠(대리점·견적·온라인몰) + 로고 + 대메뉴 5개 + 견적 버튼.
import Link from "next/link";
import { COMPANY } from "../../lib/sangji/catalog";

const NAV = [
  { href: "/sangji/products", label: "제품" },
  { href: "/sangji/solutions", label: "산업별 솔루션" },
  { href: "/sangji/resources", label: "기술자료·카탈로그" },
  { href: "/sangji/about", label: "회사소개" },
];

export default function SiteHeader({ active }: { active?: string }) {
  return (
    <>
      <div className="sj-topbar">
        <div className="sj-wrap">
          <div>
            <strong>NOK 한국 공식 대리점</strong> · Since {COMPANY.since} · 대표전화 {COMPANY.tel}
          </div>
          <nav>
            <a href="#">대리점 안내</a>
            <a href="#">기술문의</a>
            <a href="#">로그인 / 거래처 등록</a>
            <a href="#" className="mall">온라인몰 바로가기 ↗</a>
          </nav>
        </div>
      </div>
      <header className="sj-header">
        <div className="sj-wrap">
          <Link href="/sangji" className="sj-logo" aria-label="상지인터내셔날 홈">
            <span className="mark" aria-hidden="true" />
            <span>
              SANGJI
              <small>INTERNATIONAL · NOK</small>
            </span>
          </Link>
          <nav className="sj-nav" aria-label="주 메뉴">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={active === n.href ? "active" : ""}>
                {n.label}
              </Link>
            ))}
            <a href="#" className="mall">
              온라인몰<span>B2C</span>
            </a>
          </nav>
          <div className="sj-header-actions">
            <Link href="/sangji/products" className="btn btn-outline btn-sm">
              품번 검색
            </Link>
            <Link href="/sangji/quote" className="btn btn-primary btn-sm">
              견적 요청
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
