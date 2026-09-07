"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

interface Item { code: string; qty: string; note: string }

export default function QuoteForm() {
  const params = useSearchParams();
  const preset = params.get("q") ?? "";
  const [items, setItems] = useState<Item[]>([{ code: preset, qty: "1", note: "" }, { code: "", qty: "", note: "" }]);
  const [company, setCompany] = useState("");
  const [person, setPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  function setItem(i: number, k: keyof Item, v: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    const filled = items.filter((it) => it.code.trim() !== "");
    if (filled.length === 0 && memo.trim() === "") err.items = "품번을 한 줄 이상 적거나, 요청 내용에 장비·부위를 적어 주세요.";
    for (const it of filled) {
      const n = Number(it.qty);
      if (it.qty.trim() === "" || Number.isNaN(n) || n <= 0 || !Number.isInteger(n)) err.items = "수량은 1 이상의 정수로 입력해 주세요.";
    }
    if (company.trim() === "") err.company = "회사명을 입력해 주세요.";
    if (person.trim() === "") err.person = "담당자명을 입력해 주세요.";
    if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone.trim())) err.phone = "연락처 형식을 확인해 주세요 (예: 010-1234-5678).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) err.email = "이메일 형식을 확인해 주세요.";
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    // 실제 구축 시 여기서 창고(DB)에 저장하고 담당자 메일·문자를 보낸다. 시안은 접수번호만 만든다.
    const d = new Date();
    setDone(`Q${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 900) + 100)}`);
  }

  if (done !== null) {
    return (
      <div className="form">
        <div className="alert alert-ok">견적 요청이 접수되었습니다. 접수번호 <b>{done}</b> — {email} 로 확인 메일을 보냈습니다.</div>
        <h3 style={{ marginBottom: 8 }}>다음 단계</h3>
        <p style={{ color: "var(--steel)" }}>담당자가 규격·재고를 확인한 뒤 1영업일 내 견적서(PDF)를 회신합니다. 급한 건은 {`031-909-7300`} 으로 접수번호를 말씀해 주세요.</p>
        <button type="button" className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => { setDone(null); setItems([{ code: "", qty: "1", note: "" }]); }}>새 견적 요청</button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {Object.keys(errors).length > 0 ? <div className="alert alert-err" role="alert">입력 내용을 확인해 주세요. 빨간 표시 항목을 고치면 제출됩니다.</div> : null}
      <h3 style={{ marginBottom: 10 }}>1. 품목</h3>
      <table className="items" style={{ marginBottom: 6 }}>
        <thead><tr><th style={{ width: "40%" }}>품번 · 품명</th><th style={{ width: 100 }}>수량</th><th>비고 (재질·장비·부위)</th><th style={{ width: 40 }}></th></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td><input value={it.code} onChange={(e) => setItem(i, "code", e.target.value)} placeholder="TC 35-52-8" className={errors.items !== undefined && it.code.trim() === "" && i === 0 ? "bad" : ""} /></td>
              <td><input value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} placeholder="1" inputMode="numeric" /></td>
              <td><input value={it.note} onChange={(e) => setItem(i, "note", e.target.value)} placeholder="FKM 사양 / 굴삭기 붐 실린더" /></td>
              <td><button type="button" className="btn btn-ghost btn-sm" aria-label="줄 삭제" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} disabled={items.length === 1}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {errors.items !== undefined ? <div className="ferr">{errors.items}</div> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 24 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems((p) => [...p, { code: "", qty: "", note: "" }])}>+ 줄 추가</button>
        <button type="button" className="btn btn-outline btn-sm">엑셀로 여러 품목 올리기</button>
      </div>

      <h3 style={{ marginBottom: 10 }}>2. 요청 내용 · 첨부</h3>
      <label>장비·부위·요청사항 <span style={{ color: "var(--muted)", fontWeight: 400 }}>(품번을 모르면 여기 적어 주세요)</span></label>
      <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 두산 DX225 굴삭기 암 실린더 누유, 로드 패킹 세트 필요. 도면 첨부." style={{ marginBottom: 12 }} />
      <label>도면 · 사진 첨부 <span style={{ color: "var(--muted)", fontWeight: 400 }}>(PDF·JPG·DWG, 20MB 이하)</span></label>
      <input type="file" style={{ marginBottom: 24 }} />

      <h3 style={{ marginBottom: 10 }}>3. 회사 · 담당자</h3>
      <div className="frow">
        <div><label>회사명 <span className="req">*</span></label><input value={company} onChange={(e) => setCompany(e.target.value)} className={errors.company !== undefined ? "bad" : ""} />{errors.company !== undefined ? <div className="ferr">{errors.company}</div> : null}</div>
        <div><label>담당자 <span className="req">*</span></label><input value={person} onChange={(e) => setPerson(e.target.value)} className={errors.person !== undefined ? "bad" : ""} />{errors.person !== undefined ? <div className="ferr">{errors.person}</div> : null}</div>
      </div>
      <div className="frow">
        <div><label>연락처 <span className="req">*</span></label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-1234-5678" className={errors.phone !== undefined ? "bad" : ""} />{errors.phone !== undefined ? <div className="ferr">{errors.phone}</div> : null}</div>
        <div><label>이메일 <span className="req">*</span></label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.kr" className={errors.email !== undefined ? "bad" : ""} />{errors.email !== undefined ? <div className="ferr">{errors.email}</div> : null}</div>
      </div>
      <label className="row" style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
        <input type="checkbox" style={{ width: "auto" }} /> 개인정보 수집·이용에 동의합니다 (견적 회신 목적, 1년 보관)
      </label>
      <div className="actions">
        <span style={{ fontSize: 13, color: "var(--muted)" }}>접수 즉시 접수번호가 발급되고, 회신은 1영업일 내.</span>
        <button type="submit" className="btn btn-primary btn-lg">견적 요청 보내기</button>
      </div>
    </form>
  );
}
