// 시안 S6 — 회사소개. 신뢰 요소(공식 대리점·연혁·취급 분야·오시는 길)를 한 화면에.
import SiteFooter from "../../../components/sangji/SiteFooter";
import SiteHeader from "../../../components/sangji/SiteHeader";
import { COMPANY } from "../../../lib/sangji/catalog";

export default function About() {
  return (
    <>
      <SiteHeader active="/sangji/about" />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs">홈 › 회사소개</div>
          <h1>{COMPANY.name}</h1>
          <p>1997년부터 일본 NOK(주) 씰 제품을 한국 산업 현장에 공급해 온 공식 대리점입니다.</p>
        </div>
      </div>
      <div className="sj-wrap" style={{ padding: "32px 0 64px" }}>
        <div className="grid-3" style={{ marginBottom: 32 }}>
          <div className="card"><span className="en">Official</span><h3>NOK 한국 공식 대리점</h3><p>정품 공급·기술 지원·NOK 본사 자료 접근. 인증서는 자료실에서 확인.</p></div>
          <div className="card"><span className="en">Since 1997</span><h3>29년의 공급 이력</h3><p>중장비·농기계·제화기계·제철·실린더·유압 피팅 등 다양한 산업 분야.</p></div>
          <div className="card"><span className="en">B2B + B2C</span><h3>거래처 공급과 온라인 판매</h3><p>기업 거래처는 견적·정산, 개인·소량 고객은 온라인몰에서 바로 구매.</p></div>
        </div>
        <div className="grid-2">
          <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>연혁 (예시 — 실제 연혁으로 교체)</h2>
            <table className="spec-table">
              <tbody>
                <tr><th>1997</th><td>상지인터내셔날 설립, NOK 씰 지역 대리점 개시</td></tr>
                <tr><th>20xx</th><td>타이밍벨트·풀리 라인업 추가</td></tr>
                <tr><th>20xx</th><td>온라인몰(B2C) 오픈</td></tr>
                <tr><th>2016</th><td>국제모션컨트롤산업전 참가</td></tr>
                <tr><th>2026</th><td>홈페이지·온라인몰 통합 리뉴얼</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>오시는 길</h2>
            <div className="figure" style={{ height: 200 }}>지도 (카카오맵 삽입 자리)</div>
            <table className="spec-table">
              <tbody>
                <tr><th>주소</th><td>{COMPANY.address}</td></tr>
                <tr><th>전화</th><td>{COMPANY.tel}</td></tr>
                <tr><th>영업시간</th><td>{COMPANY.hours}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
