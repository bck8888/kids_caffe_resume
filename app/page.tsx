import FacilitySearch from "./facility-search";

type HomeProps={searchParams:Promise<{login?:string;authError?:string}>};

export default async function Home({searchParams}:HomeProps) {
  const params=await searchParams;
  const authMessage=params.login==="success"
    ? {kind:"success",text:"카카오 로그인이 완료됐습니다. 선택한 예약 정보를 이어서 확인해 주세요."}
    : params.authError
      ? {kind:"error",text:params.authError==="invalid_oauth_state"?"로그인 요청이 만료됐습니다. 이 화면에서 카카오 로그인을 다시 시작해 주세요.":"카카오 로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."}
      : null;
  return (
    <main>
      <header>
        <p className="eyebrow">서울형 키즈카페</p>
        <h1>예약할 시간을<br />빠르게 찾아보세요</h1>
        <p className="summary">키즈카페와 이용 시간을 한 번만 선택하면 가까운 회차를 최대 두 개 보여드려요.</p>
      </header>

      {authMessage&&<p className={`auth-banner ${authMessage.kind}`} role="status">{authMessage.text}</p>}
      <FacilitySearch />
      <footer>
        시설 기본정보 출처: 서울특별시 서울 열린데이터광장 · 예약은 서울시 공식 페이지에서 진행됩니다.<br />
        화면 상태 기술 실험은 고객용 예약 기능과 분리되어 있습니다.
      </footer>
    </main>
  );
}
