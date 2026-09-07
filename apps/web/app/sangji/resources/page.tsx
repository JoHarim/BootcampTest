// 시안 S5 — 기술자료·카탈로그. 종류(카탈로그·규격표·가이드·기술자료·인증서)별로 훑고 바로 내려받는다.
import SiteFooter from "../../../components/sangji/SiteFooter";
import SiteHeader from "../../../components/sangji/SiteHeader";
import ResourceList from "../../../components/sangji/ResourceList";

export default function Resources() {
  return (
    <>
      <SiteHeader active="/sangji/resources" />
      <div className="page-head">
        <div className="sj-wrap">
          <div className="crumbs">홈 › 기술자료·카탈로그</div>
          <h1>기술자료 · 카탈로그</h1>
          <p>NOK 정식 카탈로그, 규격표(엑셀 포함), 선정 가이드. 회원가입 없이 내려받을 수 있습니다.</p>
        </div>
      </div>
      <div className="sj-wrap" style={{ padding: "28px 0 64px" }}>
        <ResourceList />
      </div>
      <SiteFooter />
    </>
  );
}
