// 시안 S2 — 제품 검색. 정적 내보내기라 주소의 ?q=·?cat= 은 브라우저에서 읽는다(Suspense 필요).
import { Suspense } from "react";
import SiteFooter from "../../../components/sangji/SiteFooter";
import SiteHeader from "../../../components/sangji/SiteHeader";
import Catalog from "../../../components/sangji/Catalog";

export default function ProductsPage() {
  return (
    <>
      <SiteHeader active="/sangji/products" />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs">홈 › 제품</div>
          <h1>제품 검색</h1>
          <p>품번·규격·카테고리로 찾고, 재고와 납기를 확인한 뒤 견적(B2B) 또는 온라인몰 구매(B2C)로 이어집니다.</p>
        </div>
      </div>
      <div className="sj-wrap">
        <Suspense fallback={<div className="empty" style={{ margin: "28px 0" }}><h3>불러오는 중…</h3></div>}>
          <Catalog />
        </Suspense>
      </div>
      <SiteFooter />
    </>
  );
}
