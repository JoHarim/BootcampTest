// 시안 S4 — 산업별·장비별 솔루션. 탭으로 산업을 고르면 장비·권장 품목·적용 사례가 바뀐다.
import SiteFooter from "../../../components/sangji/SiteFooter";
import SiteHeader from "../../../components/sangji/SiteHeader";
import SolutionTabs from "../../../components/sangji/SolutionTabs";

export default function Solutions() {
  return (
    <>
      <SiteHeader active="/sangji/solutions" />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs">홈 › 산업별 솔루션</div>
          <h1>산업별 · 장비별 솔루션</h1>
          <p>품번을 몰라도 됩니다. 산업과 장비를 고르면 맞는 씰과 키트, 실제 적용 사례를 보여 드립니다.</p>
        </div>
      </div>
      <div className="sj-wrap" style={{ padding: "28px 0 64px" }}>
        <SolutionTabs />
      </div>
      <SiteFooter />
    </>
  );
}
