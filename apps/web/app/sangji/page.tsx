// 시안 S1 — 홈. 기업 신뢰(히어로·인증) + 산업재몰 검색(큰 검색창) + 카테고리·산업·연결 흐름·자료·공지.
import Link from "next/link";
import SearchBox from "../../components/sangji/SearchBox";
import SiteFooter from "../../components/sangji/SiteFooter";
import SiteHeader from "../../components/sangji/SiteHeader";
import { CATEGORIES, INDUSTRIES, RESOURCES } from "../../lib/sangji/catalog";

const ICONS: Record<string, string> = {
  oilseal: "◎", packing: "▣", oring: "○", belt: "≋", pulley: "✲", sealkit: "⧉", fpc: "▤",
};

export default function SangjiHome() {
  return (
    <>
      <SiteHeader />
      <section className="sj-hero">
        <div className="sj-wrap">
          <div>
            <div className="eyebrow">NOK 한국 공식 대리점 · 1997년부터</div>
            <h1>굴삭기부터 산업 로봇까지,<br />NOK 정품 씰의 기준.</h1>
            <p className="lead">
              패킹·오일씰·O-Ring·타이밍벨트. 품번이나 규격만 알면 재고와 납기를 바로 확인하고, 견적 요청부터 온라인 구매까지 한 곳에서.
            </p>
            <SearchBox />
          </div>
          <aside className="sj-trust">
            <h3>왜 상지인터내셔날인가</h3>
            <div className="grid">
              <div className="stat"><b>공식</b><span>NOK 한국 공식 대리점 인증</span></div>
              <div className="stat"><b>29년</b><span>1997년 설립, 건설기계·산업설비 B2B 공급</span></div>
              <div className="stat"><b>12,000+</b><span>취급 규격 (예시 수치)</span></div>
              <div className="stat"><b>당일 출고</b><span>재고품 오후 2시 이전 주문 시 (예시)</span></div>
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
              <span className="badge badge-nok">NOK 정품 보증</span>
              <span className="badge" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>세금계산서 · 거래처 단가</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="sj-section">
        <div className="sj-wrap">
          <div className="sj-section-head">
            <div>
              <h2>제품 카테고리</h2>
              <p>카테고리 → 형식 → 규격 순으로 좁혀 가거나, 품번으로 바로 찾습니다.</p>
            </div>
            <Link href="/sangji/products">전체 제품 검색 →</Link>
          </div>
          <div className="grid-4">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/sangji/products?cat=${c.id}`} className="card">
                <div className="icon" aria-hidden="true" style={{ fontSize: 22 }}>{ICONS[c.id]}</div>
                <span className="en">{c.en}</span>
                <h3>{c.name}</h3>
                <p>{c.desc}</p>
                <span className="more">규격 {c.specLabel} →</span>
              </Link>
            ))}
            <Link href="/sangji/quote" className="card" style={{ background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" }}>
              <div className="icon" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 22 }}>✎</div>
              <span className="en" style={{ color: "#a9bad0" }}>Quote</span>
              <h3>품번을 모르시나요?</h3>
              <p style={{ color: "#c9d6e6" }}>장비명·부위·도면만 보내 주시면 기술 담당이 규격을 찾아 견적을 드립니다.</p>
              <span className="more" style={{ color: "#ffd9de" }}>견적 요청 →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="sj-section alt">
        <div className="sj-wrap">
          <div className="sj-section-head">
            <div>
              <h2>산업별 · 장비별 솔루션</h2>
              <p>어떤 장비의 어느 부위인지로 찾으면, 맞는 씰키트와 적용 사례가 나옵니다.</p>
            </div>
            <Link href="/sangji/solutions">솔루션 전체 보기 →</Link>
          </div>
          <div className="grid-3">
            {INDUSTRIES.map((i) => (
              <Link key={i.id} href={`/sangji/solutions#${i.id}`} className="ind-card">
                <span className="tag">{i.kits.length}종 권장 품목</span>
                <h3>{i.name}</h3>
                <p>{i.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sj-section">
        <div className="sj-wrap">
          <div className="sj-section-head">
            <div>
              <h2>홈페이지와 온라인몰이 한 흐름으로</h2>
              <p>같은 제품 데이터를 쓰기 때문에, 검색한 자리에서 B2B는 견적으로, B2C는 결제로 갈라집니다.</p>
            </div>
          </div>
          <div className="flow">
            <div className="step"><div className="n">1</div><h4>검색</h4><p>품번·규격·카테고리·장비명으로 찾기. 호환 품번(구 품번)도 같이 잡힘.</p></div>
            <div className="step"><div className="n">2</div><h4>재고·납기 확인</h4><p>재고 있음 / 소량 / 발주(7~14일). 최소 주문 수량 표시.</p></div>
            <div className="step b2b"><span className="lane">B2B</span><div className="n">3</div><h4>견적 요청 → 거래처 단가</h4><p>거래처 로그인 시 계약 단가 표시. 여러 품목을 한 번에 견적, 세금계산서 발행.</p></div>
            <div className="step b2c"><span className="lane">B2C</span><div className="n">3</div><h4>온라인몰 바로 구매</h4><p>소량·개인 고객은 같은 품번 페이지에서 카드 결제. 장바구니·배송 조회는 온라인몰이 담당.</p></div>
          </div>
        </div>
      </section>

      <section className="sj-section alt">
        <div className="sj-wrap">
          <div className="sj-section-head">
            <div>
              <h2>기술자료 · 카탈로그</h2>
              <p>NOK 정식 카탈로그와 규격표, 선정 가이드를 회원가입 없이 받을 수 있습니다.</p>
            </div>
            <Link href="/sangji/resources">자료실 전체 →</Link>
          </div>
          <div className="grid-3">
            {RESOURCES.slice(0, 3).map((r) => (
              <Link key={r.id} href="/sangji/resources" className="card">
                <span className="en">{r.kind} · {r.format}</span>
                <h3>{r.title}</h3>
                <p>{r.size} · 갱신 {r.updated}</p>
                <span className="more">다운로드 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sj-section">
        <div className="sj-wrap grid-2" style={{ alignItems: "start" }}>
          <div>
            <div className="sj-section-head"><h2 style={{ fontSize: 20 }}>공지사항</h2><a href="#">더보기</a></div>
            <div className="notice-list">
              <a href="#"><span><span className="tag">공지</span>추석 연휴 출고 일정 안내</span><span>2026-09-01</span></a>
              <a href="#"><span><span className="tag">신제품</span>NOK 오일씰 FKM 사양 라인업 확대</span><span>2026-08-20</span></a>
              <a href="#"><span><span className="tag">자료</span>패킹 카탈로그 2026 개정판 등록</span><span>2026-08-05</span></a>
              <a href="#"><span><span className="tag">전시</span>국제모션컨트롤산업전 참가 안내</span><span>2026-07-15</span></a>
            </div>
          </div>
          <div className="cta-band" style={{ minHeight: 220 }}>
            <div>
              <h2>대량 · 정기 구매는 거래처 등록으로</h2>
              <p>거래처 단가, 월 정산, 세금계산서 자동 발행. 등록 후 1영업일 내 승인.</p>
            </div>
            <Link href="/sangji/quote" className="btn btn-primary btn-lg">거래처 등록 · 견적</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
