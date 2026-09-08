import FacilitySearch from "../facility-search";

export default function ExplorePage() {
  return (
    <main>
      <header>
        <p className="eyebrow">분리된 탐색 화면</p>
        <h1>서울형 키즈카페<br />시설 탐색</h1>
        <p className="summary">이 기존 탐색 경험은 오프라인 1회 예약 검토 화면과 분리되어 있습니다.</p>
      </header>
      <FacilitySearch />
      <a className="back-link" href="/">← 오프라인 예약 검토로 돌아가기</a>
    </main>
  );
}
