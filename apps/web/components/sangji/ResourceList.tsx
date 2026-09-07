"use client";
import { useState } from "react";
import { CATEGORIES, RESOURCES, type Resource } from "../../lib/sangji/catalog";

const KINDS: Array<Resource["kind"] | "전체"> = ["전체", "카탈로그", "규격표", "선정가이드", "기술자료", "인증서"];

export default function ResourceList() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("전체");
  const [cat, setCat] = useState("");
  const list = RESOURCES.filter((r) => (kind === "전체" || r.kind === kind) && (cat === "" || r.category === cat));
  return (
    <>
      <div className="results-bar">
        <div className="tabs-line" style={{ marginBottom: 0, borderBottom: 0 }}>
          {KINDS.map((k) => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{k}</button>)}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="제품군">
          <option value="">전체 제품군</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {list.length === 0 ? (
        <div className="empty"><h3>해당 조건의 자료가 없습니다</h3><p>다른 종류나 제품군을 골라 보세요.</p></div>
      ) : (
        <div className="grid-3">
          {list.map((r) => (
            <div key={r.id} className="card">
              <span className="en">{r.kind} · {r.format}</span>
              <h3>{r.title}</h3>
              <p>{r.size} · 갱신 {r.updated}{r.category !== undefined ? ` · ${CATEGORIES.find((c) => c.id === r.category)?.name ?? ""}` : ""}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <a href="#" className="btn btn-navy btn-sm">다운로드</a>
                <a href="#" className="btn btn-outline btn-sm">미리보기</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
