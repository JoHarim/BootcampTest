// 시안 S7 — 온라인 견적 요청. 품목 여러 줄 + 회사 정보 + 도면 첨부. 제출 전 검사(잘못 입력) → 접수 완료 화면.
import { Suspense } from "react";
import SiteFooter from "../../../components/sangji/SiteFooter";
import SiteHeader from "../../../components/sangji/SiteHeader";
import QuoteForm from "../../../components/sangji/QuoteForm";

export default function QuotePage() {
  return (
    <>
      <SiteHeader />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs">홈 › 온라인 견적</div>
          <h1>온라인 견적 요청</h1>
          <p>품번을 알면 품번으로, 모르면 장비·부위·도면으로. 1영업일 내 담당자가 견적서를 보내 드립니다.</p>
        </div>
      </div>
      <div className="sj-wrap" style={{ padding: "28px 0 64px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <Suspense fallback={<div className="form">불러오는 중…</div>}>
          <QuoteForm />
        </Suspense>
        <div>
          <div className="aside-box">
            <h3>견적 진행 순서</h3>
            <ol className="list-plain" style={{ color: "var(--steel)" }}>
              <li>요청 접수 (접수번호 문자·메일 발송)</li>
              <li>담당자 규격 확인 · 재고/납기 조회</li>
              <li>견적서 PDF 회신 (1영업일)</li>
              <li>승인 시 발주 → 세금계산서 · 출고</li>
            </ol>
          </div>
          <div className="aside-box" style={{ marginTop: 16 }}>
            <h3>거래처(B2B) 로그인 시</h3>
            <p>계약 단가가 자동 적용되고, 지난 견적·주문 이력에서 재주문할 수 있습니다. 월 정산·세금계산서 자동 발행.</p>
            <a href="#" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>거래처 등록 신청</a>
          </div>
          <div className="aside-box" style={{ marginTop: 16 }}>
            <h3>소량 · 개인 구매</h3>
            <p>재고 품목 1~10개 구매는 온라인몰에서 카드 결제로 바로 가능합니다.</p>
            <a href="#" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>온라인몰 바로가기 ↗</a>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
