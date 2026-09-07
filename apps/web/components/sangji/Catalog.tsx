"use client";
// 제품 검색 본체 — 왼쪽 필터(카테고리·형식·치수 범위·재질) + 오른쪽 결과표.
// 예외 처리: 결과 없음(빈 상태) · 치수 범위 잘못 입력(에러 문구) · B2B 단가는 로그인 전 잠금 표시.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CATEGORIES, MATERIALS, PRODUCTS, STOCK_LABEL, categoryOf, codeToSlug, matchesQuery, won,
  type CategoryId, type Product,
} from "../../lib/sangji/catalog";

type Sort = "rel" | "d1" | "price";

export default function Catalog() {
  const params = useSearchParams();
  const initialCat = params.get("cat");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cats, setCats] = useState<CategoryId[]>(
    initialCat !== null && CATEGORIES.some((c) => c.id === initialCat) ? [initialCat as CategoryId] : []
  );
  const [type, setType] = useState("");
  const [material, setMaterial] = useState("");
  const [dMin, setDMin] = useState("");
  const [dMax, setDMax] = useState("");
  const [sort, setSort] = useState<Sort>("rel");

  const min = dMin === "" ? null : Number(dMin);
  const max = dMax === "" ? null : Number(dMax);
  const rangeError =
    (min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))
      ? "치수는 숫자로 입력해 주세요."
      : min !== null && max !== null && min > max
        ? "최소값이 최대값보다 큽니다."
        : "";

  const types = useMemo(() => {
    const pool = cats.length === 0 ? PRODUCTS : PRODUCTS.filter((p) => cats.includes(p.category));
    return Array.from(new Set(pool.map((p) => p.type)));
  }, [cats]);

  const results = useMemo(() => {
    let list = PRODUCTS.filter((p) => matchesQuery(p, q));
    if (cats.length > 0) list = list.filter((p) => cats.includes(p.category));
    if (type !== "") list = list.filter((p) => p.type === type);
    if (material !== "") list = list.filter((p) => p.material === material);
    if (rangeError === "") {
      if (min !== null) list = list.filter((p) => p.d1 >= min);
      if (max !== null) list = list.filter((p) => p.d1 <= max);
    }
    if (sort === "d1") list = [...list].sort((a, b) => a.d1 - b.d1);
    if (sort === "price") list = [...list].sort((a, b) => a.price - b.price);
    return list;
  }, [q, cats, type, material, min, max, sort, rangeError]);

  function toggleCat(id: CategoryId) {
    setCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setType("");
  }
  function reset() {
    setQ(""); setCats([]); setType(""); setMaterial(""); setDMin(""); setDMax(""); setSort("rel");
  }

  return (
    <div className="catalog">
      <aside className="filters" aria-label="필터">
        <h3>품번 · 키워드</h3>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="TC 35-52-8, P-20, 굴삭기…" aria-label="품번 검색" />
        <h3>카테고리</h3>
        {CATEGORIES.map((c) => (
          <label key={c.id} className="row">
            <input type="checkbox" checked={cats.includes(c.id)} onChange={() => toggleCat(c.id)} />
            {c.name} <span style={{ color: "var(--muted)", fontSize: 12 }}>({PRODUCTS.filter((p) => p.category === c.id).length})</span>
          </label>
        ))}
        <h3>형식</h3>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="형식">
          <option value="">전체</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <h3>축경 · 내경 · 피치 (mm)</h3>
        <div className="range">
          <input type="text" inputMode="decimal" value={dMin} onChange={(e) => setDMin(e.target.value)} placeholder="최소" aria-label="최소 치수" />
          <span>~</span>
          <input type="text" inputMode="decimal" value={dMax} onChange={(e) => setDMax(e.target.value)} placeholder="최대" aria-label="최대 치수" />
        </div>
        {rangeError !== "" ? <div className="err" role="alert">{rangeError}</div> : null}
        <h3>재질</h3>
        <select value={material} onChange={(e) => setMaterial(e.target.value)} aria-label="재질">
          <option value="">전체</option>
          {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="button" className="btn btn-outline reset" onClick={reset}>필터 초기화</button>
      </aside>

      <section>
        <div className="results-bar">
          <div className="count">
            검색 결과 <b>{results.length}</b>건
            {q.trim() !== "" ? <> · “{q.trim()}”</> : null}
            {cats.length > 0 ? <> · {cats.map((c) => categoryOf(c).name).join(", ")}</> : null}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="lock">거래처 단가는 로그인 후 표시</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
              <option value="rel">관련도순</option>
              <option value="d1">치수 오름차순</option>
              <option value="price">가격 낮은순</option>
            </select>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty">
            <h3>일치하는 제품이 없습니다</h3>
            <p>
              품번 표기가 다를 수 있습니다 (예: 구 품번·OEM 품번). 규격(축경·외경·폭)이나 장비명으로 다시 찾아보시거나, 견적 요청에 품번·도면을 남겨 주시면 기술 담당이 찾아 드립니다.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button type="button" className="btn btn-outline" onClick={reset}>필터 초기화</button>
              <Link href={`/sangji/quote?q=${encodeURIComponent(q)}`} className="btn btn-primary">이 품번으로 견적 요청</Link>
            </div>
          </div>
        ) : (
          <div className="ptable">
            <table>
              <thead>
                <tr>
                  <th>품번</th><th>형식 · 규격</th><th>재질</th><th>재고 · 납기</th><th style={{ textAlign: "right" }}>온라인몰가</th><th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => <Row key={p.code} p={p} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ p }: { p: Product }) {
  return (
    <tr>
      <td>
        <Link href={`/sangji/products/${codeToSlug(p.code)}`} className="code">{p.code}</Link>
        <span className="sub">{p.name}</span>
      </td>
      <td>{p.type} · {p.spec}<span className="sub">{categoryOf(p.category).specLabel}</span></td>
      <td>{p.material}</td>
      <td><span className={`badge badge-${p.stock}`}>{STOCK_LABEL[p.stock]}</span>{p.moq > 1 ? <span className="sub">최소 {p.moq}개</span> : null}</td>
      <td style={{ textAlign: "right" }}>
        {p.price === 0 ? <span className="lock">개별 견적</span> : <span className="price">{won(p.price)}</span>}
        <span className="sub lock">🔒 거래처 단가</span>
      </td>
      <td>
        <div className="acts">
          <Link href={`/sangji/quote?q=${encodeURIComponent(p.code)}`} className="btn btn-outline btn-sm">견적 담기</Link>
          {p.price === 0 ? null : <a href="#" className="btn btn-primary btn-sm">온라인몰 구매</a>}
        </div>
      </td>
    </tr>
  );
}
