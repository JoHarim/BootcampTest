// 시안 S3 — 제품 상세. 규격표·호환 품번·적용 장비·같은 형식의 다른 규격(미스미식 배리에이션) + 구매 박스.
import Link from "next/link";
import SiteFooter from "../../../../components/sangji/SiteFooter";
import SiteHeader from "../../../../components/sangji/SiteHeader";
import { PRODUCTS, RESOURCES, STOCK_LABEL, allCodes, categoryOf, codeToSlug, findProduct, won } from "../../../../lib/sangji/catalog";

export function generateStaticParams() {
  return allCodes().map((code) => ({ code: codeToSlug(code) }));
}

export default async function ProductDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = findProduct(decodeURIComponent(code));
  if (p === null) {
    return (
      <>
        <SiteHeader active="/sangji/products" />
        <div className="sj-wrap" style={{ padding: "48px 0" }}>
          <div className="empty">
            <h3>해당 품번을 찾을 수 없습니다</h3>
            <p>단종·품번 변경일 수 있습니다. 검색으로 돌아가거나 견적 요청에 품번을 남겨 주세요.</p>
            <Link href="/sangji/products" className="btn btn-outline">제품 검색으로</Link>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }
  const cat = categoryOf(p.category);
  const siblings = PRODUCTS.filter((x) => x.type === p.type && x.code !== p.code).slice(0, 6);
  const docs = RESOURCES.filter((r) => r.category === p.category).slice(0, 3);
  const dims = cat.specLabel.split(" × ");

  return (
    <>
      <SiteHeader active="/sangji/products" />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs"><Link href="/sangji">홈</Link> › <Link href="/sangji/products">제품</Link> › <Link href={`/sangji/products?cat=${p.category}`}>{cat.name}</Link> › {p.type}</div>
          <h1>{p.code}</h1>
          <p>{p.name} · {p.spec} · {p.material}</p>
        </div>
      </div>
      <div className="sj-wrap detail">
        <div>
          <div className="figure">제품 이미지 · 단면도 (NOK 카탈로그 도면 삽입 자리)</div>
          <h2 className="section-title" style={{ marginTop: 0 }}>규격</h2>
          <table className="spec-table">
            <tbody>
              <tr><th>품번</th><td>{p.code}</td></tr>
              <tr><th>카테고리 · 형식</th><td>{cat.name} · {p.type}</td></tr>
              {p.d2 > 0 ? (
                <>
                  <tr><th>{dims[0] ?? "치수 1"}</th><td>{p.d1} mm</td></tr>
                  <tr><th>{dims[1] ?? "치수 2"}</th><td>{p.d2} mm</td></tr>
                  {p.d3 > 0 ? <tr><th>{dims[2] ?? "치수 3"}</th><td>{p.d3} mm</td></tr> : null}
                </>
              ) : (
                <tr><th>구성</th><td>{p.spec}</td></tr>
              )}
              <tr><th>재질</th><td>{p.material}</td></tr>
              {p.crossRef !== undefined ? <tr><th>NOK 품번 · 호환</th><td>{p.crossRef.join(", ")} <span className="lock" style={{ fontSize: 12, color: "var(--muted)" }}>(예시)</span></td></tr> : null}
              <tr><th>적용 장비</th><td>{p.apps.join(" · ")}</td></tr>
              <tr><th>최소 주문 수량</th><td>{p.moq}개</td></tr>
            </tbody>
          </table>

          {siblings.length > 0 ? (
            <>
              <h2 className="section-title">같은 형식({p.type})의 다른 규격</h2>
              <div className="ptable">
                <table>
                  <thead><tr><th>품번</th><th>규격</th><th>재질</th><th>재고</th><th style={{ textAlign: "right" }}>온라인몰가</th></tr></thead>
                  <tbody>
                    {siblings.map((s) => (
                      <tr key={s.code}>
                        <td><Link href={`/sangji/products/${codeToSlug(s.code)}`} className="code">{s.code}</Link></td>
                        <td>{s.spec}</td><td>{s.material}</td>
                        <td><span className={`badge badge-${s.stock}`}>{STOCK_LABEL[s.stock]}</span></td>
                        <td style={{ textAlign: "right" }} className="price">{s.price === 0 ? "개별 견적" : won(s.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {docs.length > 0 ? (
            <>
              <h2 className="section-title">관련 기술자료</h2>
              <div className="grid-3">
                {docs.map((r) => (
                  <Link key={r.id} href="/sangji/resources" className="card">
                    <span className="en">{r.kind} · {r.format}</span>
                    <h3 style={{ fontSize: 14.5 }}>{r.title}</h3>
                    <span className="more">다운로드 →</span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <aside className="buybox">
          <span className="badge badge-nok">NOK 정품</span>
          <div className="code" style={{ marginTop: 8 }}>{p.code}</div>
          <div className="row"><span>재고 · 납기</span><span className={`badge badge-${p.stock}`}>{STOCK_LABEL[p.stock]}</span></div>
          <div className="row"><span>온라인몰가 (B2C)</span><b>{p.price === 0 ? "개별 견적" : won(p.price)}</b></div>
          <div className="row"><span>거래처 단가 (B2B)</span><span>🔒 <a href="#" style={{ color: "var(--navy-3)", fontWeight: 600 }}>로그인 후 표시</a></span></div>
          <div className="row"><span>수량</span><span className="qty"><input type="number" defaultValue={p.moq} min={p.moq} aria-label="수량" /> 개</span></div>
          <div className="cta">
            <Link href={`/sangji/quote?q=${encodeURIComponent(p.code)}`} className="btn btn-navy btn-lg">견적 요청에 담기</Link>
            {p.price === 0 ? null : <a href="#" className="btn btn-primary btn-lg">온라인몰에서 바로 구매 ↗</a>}
            <a href="#" className="btn btn-ghost">규격 선정 문의 (기술 담당)</a>
          </div>
          <p className="note">발주 품목은 NOK 본사 리드타임 기준 7~14일. 대체 규격이 있으면 견적 회신 시 함께 안내합니다. 가격은 VAT 별도 (예시).</p>
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}
