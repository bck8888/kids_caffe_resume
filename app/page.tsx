import FacilitySearch from "./facility-search";

export default function Home() {
  return (
    <main>
      <header>
        <p className="eyebrow">서울형 키즈카페</p>
        <h1>오늘 갈 수 있는<br />키즈카페를 찾아보세요</h1>
        <p className="summary">위치와 날짜를 기준으로 시설과 남은 자리를 확인합니다.</p>
      </header>

      <FacilitySearch />
      <footer>
        시설 기본정보 출처: 서울특별시 서울 열린데이터광장 · 예약은 서울시 공식 페이지에서 진행됩니다.
      </footer>
    </main>
  );
}
