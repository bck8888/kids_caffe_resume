"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AGREEMENT_VERSION, FIXTURE_FACILITIES, FIXTURE_SCENARIOS, MORNING_FIXTURE_VERSION,
  runMorningFixture, type FixtureScenarioId, type MorningFixtureResult
} from "../lib/reservation/morning-fixture";
import {
  DISTRICTS, JOURNEY_STEPS, OUTSIDE_AREAS, PRODUCT_NAME, THEME_STORAGE_KEY, THEME_VALUES,
  presentFixtureResult, type ThemePreference
} from "../lib/reservation/morning-presentation";

const AGREEMENTS = [
  { id: "sms_receipt", label: "예약 안내를 문자로 받는 데 동의해요" },
  { id: "personal_data", label: "예약에 필요한 개인정보 이용에 동의해요" },
  { id: "terms", label: "이용 약관과 시설 규칙을 확인했어요" }
] as const;
const themeLabels: Record<ThemePreference, string> = { system: "기기 설정", light: "라이트", dark: "나이트" };
const facilityName = (id: string) => FIXTURE_FACILITIES.find((facility) => facility.id === id)?.name ?? "선택한 키즈카페";

export default function MorningReview() {
  const [step, setStep] = useState(1);
  const [scenario, setScenario] = useState<FixtureScenarioId>("success");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [residenceBranch, setResidenceBranch] = useState<"seoul" | "non_seoul">("seoul");
  const [districtIndex, setDistrictIndex] = useState(0);
  const [neighborhoodIndex, setNeighborhoodIndex] = useState(0);
  const [outsideIndex, setOutsideIndex] = useState(0);
  const [approved, setApproved] = useState<string[]>([]);
  const [result, setResult] = useState<MorningFixtureResult>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const themeEffectStartedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const allApproved = approved.length === AGREEMENTS.length;
  const scenarioLabel = useMemo(() => FIXTURE_SCENARIOS.find((item) => item.id === scenario)?.label, [scenario]);
  const resultCopy = result ? presentFixtureResult(result) : undefined;

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_VALUES.includes(stored as ThemePreference)) setTheme(stored as ThemePreference);
  }, []);

  useEffect(() => {
    if (!themeEffectStartedRef.current) {
      themeEffectStartedRef.current = true;
      return;
    }
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      document.documentElement.dataset.theme = theme;
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function cycleTheme() {
    setTheme((current) => THEME_VALUES[(THEME_VALUES.indexOf(current) + 1) % THEME_VALUES.length]);
  }
  function toggleAgreement(id: string) {
    setApproved((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function moveTo(nextStep: number) {
    if (nextStep > step) {
      const activeControls = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(".journey-step:not([hidden]) input, .journey-step:not([hidden]) select");
      const invalid = activeControls ? [...activeControls].find((control) => !control.checkValidity()) : undefined;
      if (invalid) { invalid.reportValidity(); return; }
    }
    setStep(nextStep);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (runningRef.current || !allApproved) return;
    runningRef.current = true;
    setRunning(true);
    setError("");
    setResult(undefined);
    try {
      const data = new FormData(event.currentTarget);
      const facilityIds = [String(data.get("facility1") ?? ""), String(data.get("facility2") ?? "")].filter(Boolean);
      const requestedTimes = [String(data.get("time1") ?? ""), String(data.get("time2") ?? "")].filter(Boolean);
      const district = DISTRICTS[districtIndex];
      const neighborhood = district.neighborhoods[neighborhoodIndex] ?? district.neighborhoods[0];
      const outside = OUTSIDE_AREAS[outsideIndex];
      const residence = residenceBranch === "seoul"
        ? { branch: "seoul" as const, districtCode: district.code, neighborhoodCode: neighborhood.code }
        : { branch: "non_seoul" as const, provinceCode: outside.provinceCode, localAuthorityCode: outside.localAuthorityCode };
      const next = await runMorningFixture(scenario, {
        date: String(data.get("date") ?? ""), facilityIds, requestedTimes,
        child: { name: String(data.get("childName") ?? ""), birthYear: Number(data.get("birthYear")), birthMonth: Number(data.get("birthMonth")), sex: String(data.get("childSex")) as "female" | "male" },
        residence, guardianTotal: Number(data.get("guardianTotal")) as 1 | 2, approvedAgreementIds: approved
      });
      setResult(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "입력을 한 번 더 확인해 주세요.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  return <>
    <header className="product-header">
      <a className="brand" href="/" aria-label={`${PRODUCT_NAME} 홈`}><span aria-hidden="true">○</span>{PRODUCT_NAME}</a>
      <button className="theme-toggle" type="button" onClick={cycleTheme} aria-label={`화면 테마: ${themeLabels[theme]}. 눌러서 변경`}><span aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span>{themeLabels[theme]}</button>
    </header>
    <div className="test-mode-note" role="note"><span>연습 모드</span> 실제 서울시 예약은 진행되지 않아요.</div>
    <nav className="journey-progress" aria-label="예약 단계">
      <ol>{JOURNEY_STEPS.map((item) => <li key={item.id} className={step === item.id ? "current" : step > item.id ? "done" : ""} aria-current={step === item.id ? "step" : undefined}><span>{step > item.id ? "✓" : item.id}</span><small>{item.short}</small></li>)}</ol>
      <div className="progress-track"><span style={{ width: `${((step - 1) / 2) * 100}%` }} /></div>
    </nav>

    <form ref={formRef} className="journey-form" onSubmit={submit}>
      <section className="journey-step" hidden={step !== 1} aria-labelledby="step-one-title">
        <p className="step-kicker">1단계 · 예약 조건</p><h1 id="step-one-title">{JOURNEY_STEPS[0].title}</h1>
        <p className="step-summary">가장 원하는 장소와 시간을 먼저 확인하고, 자리가 없을 때 볼 두 번째 선택을 정해요.</p>
        <label className="field-label">이용할 날짜<input name="date" type="date" defaultValue="2026-09-07" required /></label>
        <fieldset className="priority-group"><legend>키즈카페 순서</legend><p>자리가 있으면 첫 번째 장소에서 멈춰요.</p>
          <label className="priority-card"><span className="priority-badge">먼저</span><span><strong>가장 가고 싶은 곳</strong><small>첫 번째로 확인해요</small></span><select name="facility1" defaultValue="FXCAFE01" aria-label="가장 가고 싶은 키즈카페" required>{FIXTURE_FACILITIES.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
          <label className="priority-card optional"><span className="priority-badge">다음</span><span><strong>자리가 없을 때 볼 곳</strong><small>선택하지 않아도 괜찮아요</small></span><select name="facility2" defaultValue="FXCAFE02" aria-label="두 번째로 확인할 키즈카페"><option value="">선택하지 않음</option>{FIXTURE_FACILITIES.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
        </fieldset>
        <fieldset className="priority-group"><legend>이용 시간 순서</legend><p>원하는 시간이 포함된 회차부터 차례로 확인해요.</p>
          <label className="priority-card"><span className="priority-badge">먼저</span><span><strong>가장 원하는 시간</strong><small>예: 오전 10시</small></span><input name="time1" type="time" min="09:00" max="18:00" defaultValue="10:00" required /></label>
          <label className="priority-card optional"><span className="priority-badge">다음</span><span><strong>괜찮은 다른 시간</strong><small>선택 사항이에요</small></span><input name="time2" type="time" min="09:00" max="18:00" defaultValue="14:00" /></label>
        </fieldset>
        <button className="next-button" type="button" onClick={() => moveTo(2)}>가족 정보 입력하기</button>
      </section>

      <section className="journey-step" hidden={step !== 2} aria-labelledby="step-two-title">
        <p className="step-kicker">2단계 · 가족 정보</p><h1 id="step-two-title">{JOURNEY_STEPS[1].title}</h1>
        <p className="step-summary">공식 예약 양식에 필요한 최소 항목만 받아요. 입력 내용은 이 탭을 닫으면 남지 않아요.</p>
        <div className="family-fields">
          <label className="field-label wide">아이 이름<input name="childName" autoComplete="off" maxLength={80} defaultValue="테스트 아동" required /></label>
          <label className="field-label">태어난 해<input name="birthYear" type="number" min="2000" max="2026" defaultValue="2021" inputMode="numeric" required /></label>
          <label className="field-label">태어난 달<select name="birthMonth" defaultValue="5">{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}월</option>)}</select></label>
          <label className="field-label">공식 양식의 성별<select name="childSex" defaultValue="female"><option value="female">여</option><option value="male">남</option></select></label>
          <label className="field-label">보호자 인원<select name="guardianTotal" defaultValue="2"><option value="1">1명 · 신청자만</option><option value="2">2명 · 신청자와 동반 1명</option></select></label>
        </div>
        <fieldset className="residence-group"><legend>거주 지역</legend>
          <div className="segmented-control"><button type="button" className={residenceBranch === "seoul" ? "selected" : ""} aria-pressed={residenceBranch === "seoul"} onClick={() => setResidenceBranch("seoul")}>서울</button><button type="button" className={residenceBranch === "non_seoul" ? "selected" : ""} aria-pressed={residenceBranch === "non_seoul"} onClick={() => setResidenceBranch("non_seoul")}>서울 외 지역</button></div>
          {residenceBranch === "seoul" ? <div className="family-fields"><label className="field-label">자치구<select value={districtIndex} onChange={(event) => { setDistrictIndex(Number(event.target.value)); setNeighborhoodIndex(0); }}>{DISTRICTS.map((item, index) => <option key={item.code} value={index}>{item.label}</option>)}</select></label><label className="field-label">동네<select value={neighborhoodIndex} onChange={(event) => setNeighborhoodIndex(Number(event.target.value))}>{DISTRICTS[districtIndex].neighborhoods.map((item, index) => <option key={item.code} value={index}>{item.label}</option>)}</select></label></div> : <label className="field-label">지역<select value={outsideIndex} onChange={(event) => setOutsideIndex(Number(event.target.value))}>{OUTSIDE_AREAS.map((item, index) => <option key={item.localAuthorityCode} value={index}>{item.label}</option>)}</select></label>}
        </fieldset>
        <aside className="privacy-note"><span aria-hidden="true">⌁</span><div><strong>입력은 잠시만 사용해요</strong><p>개인정보는 서버나 결과 기록에 저장하지 않고, 한 번의 연습이 끝나면 메모리에서 지워요.</p></div></aside>
        <div className="step-actions"><button className="back-button" type="button" onClick={() => moveTo(1)}>이전</button><button className="next-button" type="button" onClick={() => moveTo(3)}>마지막 확인하기</button></div>
      </section>

      <section className="journey-step final-step" hidden={step !== 3} aria-labelledby="step-three-title">
        <p className="step-kicker">3단계 · 확인과 허용</p><h1 id="step-three-title">{JOURNEY_STEPS[2].title}</h1>
        <p className="step-summary">아래 조건에 맞는 자리를 순서대로 찾고, 가능한 자리 하나에만 한 번 시도해요.</p>
        <div className="review-summary"><div><span>확인 순서</span><strong>첫 번째 장소·시간부터, 자리가 없으면 다음 선택</strong></div><div><span>시도 범위</span><strong>가능한 자리 1건 · 자동 재시도 없음</strong></div><div><span>현재 환경</span><strong>연습용 데이터 · 실제 예약 없음</strong></div></div>
        <div className="agreement-list"><h2>확인하고 동의해 주세요</h2>{AGREEMENTS.map((agreement) => <label className="check-row" key={agreement.id}><input type="checkbox" checked={approved.includes(agreement.id)} onChange={() => toggleAgreement(agreement.id)} /><span><strong>{agreement.label}</strong><small>현재 안내 버전 적용</small></span></label>)}</div>
        <button className="back-button final-back" type="button" onClick={() => moveTo(2)}>가족 정보로 돌아가기</button>
      </section>
      {step === 3 && !result && <div className="sticky-authorization"><div><strong>딱 한 번만 시도해요</strong><small>결과가 불분명하면 멈추고 직접 확인을 요청해요.</small></div><button className="authorize-button" type="submit" disabled={!allApproved || running}>{running ? "한 번 확인하는 중…" : "이 조건으로 1회 예약 시도"}</button>{!allApproved && <small className="button-help">세 가지 확인을 모두 선택하면 시작할 수 있어요.</small>}</div>}
    </form>

    {error && <section className="customer-result result-stopped" role="alert"><p className="result-eyebrow">입력을 확인해 주세요</p><h2>아직 시작하지 않았어요</h2><p>{error}</p></section>}
    {result && resultCopy && <section ref={resultRef} className={`customer-result result-${resultCopy.tone}`} aria-live="polite"><div className="result-icon" aria-hidden="true">{resultCopy.tone === "success" ? "✓" : resultCopy.tone === "holiday" ? "☾" : resultCopy.tone === "confirmation" ? "?" : "!"}</div><p className="result-eyebrow">{resultCopy.eyebrow}</p><h2>{resultCopy.title}</h2><p>{resultCopy.message}</p><div className="next-step"><strong>다음에 할 일</strong><p>{resultCopy.next}</p></div><button className="result-back" type="button" onClick={() => { setResult(undefined); moveTo(1); }}>조건 다시 고르기</button></section>}

    <details className="developer-panel"><summary><span>개발·테스트 정보</span><small>연습 환경 세부 설정</small></summary><div className="developer-body">
      <label className="field-label">재현할 상황<select value={scenario} onChange={(event) => setScenario(event.target.value as FixtureScenarioId)}>{FIXTURE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <dl><div><dt>선택된 상황</dt><dd>{scenarioLabel}</dd></div><div><dt>픽스처 버전</dt><dd><code>{MORNING_FIXTURE_VERSION}</code></dd></div><div><dt>승인 버전</dt><dd><code>{AGREEMENT_VERSION}</code></dd></div><div><dt>연결 상태</dt><dd>공식 제출 비활성화 · 라이브 요청 0</dd></div></dl>
      {result && <><div className="dev-candidates"><strong>고정 후보 평가 기록</strong><ol>{result.candidates.map((candidate) => <li key={candidate.key}>{facilityName(candidate.facilityId)} · {candidate.requestedTime}{result.selected?.key === candidate.key ? " · 선택됨" : ""}</li>)}</ol></div><details className="safe-trace"><summary>개인정보 없는 안전 추적 보기</summary><pre>{JSON.stringify(result.safeTrace, null, 2)}</pre></details></>}
      <p className="dev-boundary">모델을 사용하지 않으며 서울시 사이트를 열거나 로그인·제출·취소하지 않습니다.</p>
    </div></details>
    <footer className="morning-footer">{PRODUCT_NAME} 연습 환경 · 개인 설정은 화면 테마만 이 기기에 저장해요.<br />시설 탐색은 <a href="/explore">별도 화면</a>에서 이용할 수 있어요.</footer>
  </>;
}
