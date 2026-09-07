"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { INDUSTRIES, STOCK_LABEL, codeToSlug, findProduct } from "../../lib/sangji/catalog";

export default function SolutionTabs() {
  const [cur, setCur] = useState(INDUSTRIES[0].id);
  // 홈에서 #construction 처럼 들어오면 그 탭을 연다
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h !== "" && INDUSTRIES.some((i) => i.id === h)) setCur(h);
  }, []);
  const ind = INDUSTRIES.find((i) => i.id === cur) ?? INDUSTRIES[0];

  return (
    <>
      <div className="tabs-line" role="tablist">
        {INDUSTRIES.map((i) => (
          <button key={i.id} role="tab" aria-selected={cur === i.id} className={cur === i.id ? "on" : ""} onClick={() => setCur(i.id)}>{i.name}</button>
        ))}
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--navy)", marginBottom: 6 }}>{ind.name}</h2>
          <p style={{ color: "var(--steel)", marginBottom: 20 }}>{ind.tagline}</p>
          <h3 className="section-title" style={{ marginTop: 0, fontSize: 15 }}>대표 장비 · 부위</h3>
          <ul className="list-plain">{ind.equipment.map((e) => <li key={e}>{e}</li>)}</ul>
          <h3 className="section-title" style={{ fontSize: 15 }}>권장 품목</h3>
          <div className="ptable">
            <table>
              <thead><tr><th>품번</th><th>품명</th><th>재고</th><th></th></tr></thead>
              <tbody>
                {ind.kits.map((k) => {
                  const p = findProduct(k);
                  if (p === null) return <tr key={k}><td className="code">{k}</td><td colSpan={3}>—</td></tr>;
                  return (
                    <tr key={k}>
                      <td><Link href={`/sangji/products/${codeToSlug(p.code)}`} className="code">{p.code}</Link></td>
                      <td>{p.name}<span className="sub">{p.spec}</span></td>
                      <td><span className={`badge badge-${p.stock}`}>{STOCK_LABEL[p.stock]}</span></td>
                      <td><div className="acts"><Link href={`/sangji/quote?q=${encodeURIComponent(p.code)}`} className="btn btn-outline btn-sm">견적 담기</Link></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="case">
            <div className="k">적용 사례</div>
            <h3>{ind.caseTitle}</h3>
            <p>{ind.caseBody}</p>
          </div>
          <div className="aside-box" style={{ marginTop: 16 }}>
            <h3>이 산업 담당자에게 문의</h3>
            <p>장비 모델·부위·사진이나 도면을 보내 주시면 규격을 찾아 견적을 드립니다. 평일 09:00~18:00, 회신 1영업일.</p>
            <Link href="/sangji/quote" className="btn btn-primary" style={{ marginTop: 12 }}>도면 첨부 견적 요청</Link>
          </div>
        </div>
      </div>
    </>
  );
}
