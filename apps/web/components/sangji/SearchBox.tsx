"use client";
// 히어로용 큰 검색창. 탭(품번·규격·카테고리)에 따라 안내 문구가 바뀌고, 제출하면 /sangji/products?q=... 로 보낸다.
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "code" | "spec" | "cat";
const PLACEHOLDER: Record<Mode, string> = {
  code: "품번 입력 — 예: TC 35-52-8, P-20, USH 40-50-6, SK-EX200",
  spec: "규격 입력 — 예: 35 52 8 (축경 외경 폭), 내경 19.8",
  cat: "카테고리·장비명 — 예: 오일씰, 굴삭기 씰키트, 타이밍벨트",
};

export default function SearchBox({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    router.push(v === "" ? "/sangji/products" : `/sangji/products?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="sj-search">
      <div className="tabs" role="tablist">
        {(["code", "spec", "cat"] as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
            {m === "code" ? "품번" : m === "spec" ? "규격" : "카테고리"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} role="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={PLACEHOLDER[mode]} aria-label="제품 검색" />
        <button type="submit" className="btn btn-navy">검색</button>
      </form>
      {compact === true ? null : (
        <div className="hint">
          <span>자주 찾는 품번</span>
          {["TC 35-52-8", "P-20", "USH 40-50-6", "SK-EX200-BOOM", "S5M-600-15"].map((c) => (
            <button key={c} type="button" className="chip" style={{ border: "1px solid var(--line)", background: "var(--bg)" }} onClick={() => setQ(c)}>
              {c}
            </button>
          ))}
          <span style={{ marginLeft: "auto" }}>공백·하이픈은 무시하고 찾습니다 (tc3552 도 OK)</span>
        </div>
      )}
    </div>
  );
}
