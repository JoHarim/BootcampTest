// 리뉴얼 시안 공통 바닥(푸터). 회사 정보·메뉴·연락처. 사업자번호 등 실제 값은 구축 시 채운다.
import Link from "next/link";
import { CATEGORIES, COMPANY } from "../../lib/sangji/catalog";

export default function SiteFooter() {
  return (
    <footer className="sj-footer">
      <div className="sj-wrap">
        <div className="cols">
          <div>
            <h4>{COMPANY.name} · {COMPANY.en}</h4>
            <p>{COMPANY.address}</p>
            <p>TEL {COMPANY.tel} · {COMPANY.hours}</p>
            <p style={{ marginTop: 10 }}>일본 NOK(주) 한국 공식 대리점 — 패킹·오일씰·O-Ring·타이밍벨트·풀리·씰키트·FPC</p>
          </div>
          <div>
            <h4>제품</h4>
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/sangji/products?cat=${c.id}`}>{c.name}</Link>
            ))}
          </div>
          <div>
            <h4>지원</h4>
            <Link href="/sangji/quote">온라인 견적</Link>
            <Link href="/sangji/resources">카탈로그·기술자료</Link>
            <a href="#">대리점 안내</a>
            <a href="#">배송·반품 안내</a>
          </div>
          <div>
            <h4>회사</h4>
            <Link href="/sangji/about">회사소개</Link>
            <a href="#">공지사항</a>
            <a href="#">오시는 길</a>
            <a href="#">온라인몰 (B2C) ↗</a>
          </div>
        </div>
        <div className="legal">
          <span>© {COMPANY.name}. 사업자등록번호·통신판매업신고번호는 구축 시 기재.</span>
          <span>리뉴얼 시안 v0.1 — 화면의 품번·가격·재고는 예시</span>
        </div>
      </div>
    </footer>
  );
}
