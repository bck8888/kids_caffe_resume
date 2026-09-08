import { createOnDeviceReservationIntent } from "../on-device/assistant-protocol.ts";
import {
  executeFixtureReservationSubmit,
  FIXTURE_SUBMIT_CAPABILITY,
  KNOWN_REVIEW_FORM_ID,
  KNOWN_REVIEW_FORM_PATH,
  KNOWN_REVIEW_SCREEN_ID,
  KNOWN_SUBMIT_CONTROL_ID,
  OneTimeSubmitAuthorizationStore,
  type FixtureReviewObservation
} from "../on-device/fixture-submit-protocol.ts";
import { createEphemeralReservationInput, MemoryEphemeralReservationStore } from "../privacy/reservation-privacy.ts";
import {
  createReservationExecutionRun,
  MemoryExecutionLock,
  type AtomicAvailabilityObservation,
  type Candidate,
  type CandidateResolution,
  type FacilityAvailability,
  type ExecutionState,
  type SafeExecutionTrace
} from "./execution-core.ts";

export const MORNING_FIXTURE_VERSION = "morning-fixture-2026-09-06-v1";
export const AGREEMENT_VERSION = "fixture-2026-09-06-v1";

export const FIXTURE_FACILITIES = [
  { id: "FXCAFE01", name: "방배 두 개 놀이터" },
  { id: "FXCAFE02", name: "상암 충전소 놀이터" },
  { id: "FXCAFE03", name: "종로 가족 놀이터" }
] as const;

export const FIXTURE_SCENARIOS = [
  { id: "success", label: "성공 + 예약 내역 일치" },
  { id: "all_unavailable", label: "모든 후보 예약 불가" },
  { id: "holiday", label: "명시적 휴관" },
  { id: "ambiguous_unavailable", label: "사유 없는 예약 불가" },
  { id: "popup_unknown", label: "알 수 없는 팝업/화면" },
  { id: "validation_error", label: "공식 폼 검증 오류" },
  { id: "post_submit_ambiguity", label: "제출 후 결과 불명" },
  { id: "double_click_replay", label: "더블클릭/재실행" }
] as const;

export type FixtureScenarioId = typeof FIXTURE_SCENARIOS[number]["id"];

export type MorningFixtureInput = {
  date: string;
  facilityIds: string[];
  requestedTimes: string[];
  child: { name: string; birthYear: number; birthMonth: number; sex: "female" | "male" };
  residence:
    | { branch: "seoul"; districtCode: string; neighborhoodCode: string }
    | { branch: "non_seoul"; provinceCode: string; localAuthorityCode: string };
  guardianTotal: 1 | 2;
  approvedAgreementIds: string[];
};

export type FixtureStage = {
  id: "evaluation" | "selection" | "lock" | "form" | "dispatch" | "completion" | "list" | "replay";
  status: "pass" | "stop" | "pending";
  label: string;
  detail: string;
};

export type MorningFixtureResult = {
  outcome: "succeeded" | "stopped" | "confirmation_required";
  reasonCode: string;
  candidates: Candidate[];
  selected?: CandidateResolution;
  stages: FixtureStage[];
  safeTrace: {
    classification: string;
    state: ExecutionState;
    reasonCode: string;
    authorizationConsumed: boolean;
    dispatchAttempted: boolean;
    trace: SafeExecutionTrace[];
  };
};

const agreementVersions = ["sms_receipt", "personal_data", "terms"].map((agreementId) => ({
  agreementId: agreementId as "sms_receipt" | "personal_data" | "terms",
  version: AGREEMENT_VERSION
}));

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function clock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function availableSessions(times: string[], facilityIndex: number) {
  return times.map((time, timeIndex) => ({
    sessionId: `FXS${facilityIndex + 1}${timeIndex + 1}`,
    startTime: clock(minutes(time) - 1),
    endTime: clock(minutes(time) + 1),
    useType: "individual" as const,
    remainingCapacity: 4
  }));
}

function availabilityFor(scenario: FixtureScenarioId, times: string[], facilityIndex: number): FacilityAvailability {
  if (scenario === "all_unavailable") return { kind: "unavailable" };
  if (scenario === "holiday") return { kind: "explicit_holiday" };
  if (scenario === "ambiguous_unavailable") return { kind: "ambiguous" };
  return { kind: "available", sessions: availableSessions(times, facilityIndex) };
}

function stage(id: FixtureStage["id"], status: FixtureStage["status"], label: string, detail: string): FixtureStage {
  return { id, status, label, detail };
}

function validateInput(input: MorningFixtureInput) {
  if (input.facilityIds.length < 1 || input.facilityIds.length > 2) throw new TypeError("시설 우선순위를 1~2개 선택해 주세요.");
  if (input.requestedTimes.length < 1 || input.requestedTimes.length > 2) throw new TypeError("시간 우선순위를 1~2개 선택해 주세요.");
  if (new Set(input.facilityIds).size !== input.facilityIds.length) throw new TypeError("시설 우선순위는 서로 달라야 합니다.");
  if (new Set(input.requestedTimes).size !== input.requestedTimes.length) throw new TypeError("시간 우선순위는 서로 달라야 합니다.");
  if (input.approvedAgreementIds.length !== 3 || new Set(input.approvedAgreementIds).size !== 3 ||
      !agreementVersions.every(({ agreementId }) => input.approvedAgreementIds.includes(agreementId))) {
    throw new TypeError("표시된 3개 약관 버전을 모두 명시적으로 승인해 주세요.");
  }
}

export async function runMorningFixture(
  scenario: FixtureScenarioId,
  input: MorningFixtureInput,
  now = new Date()
): Promise<MorningFixtureResult> {
  validateInput(input);
  const stages: FixtureStage[] = [];
  const authorizationId = `fixtureauth${now.getTime()}`;
  const requestId = `fixturereq${now.getTime()}`;
  const rules = input.facilityIds.map((facilityId) => ({
    facilityId,
    status: "confirmed" as const,
    includesApplicant: true as const,
    maxGuardianTotal: 2,
    observedAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 86_400_000).toISOString()
  }));
  const creation = createReservationExecutionRun({
    requestId,
    authorizationId,
    authorizationIssuedAt: now.toISOString(),
    authorizationExpiresAt: new Date(now.getTime() + 120_000).toISOString(),
    date: input.date,
    facilityIds: input.facilityIds,
    requestedTimes: input.requestedTimes,
    childCount: 1,
    accompanyingGuardianCount: (input.guardianTotal - 1) as 0 | 1,
    guardianRules: rules
  }, now);
  if (!creation.ok) throw new TypeError(`입력을 확인해 주세요: ${creation.reasonCode}`);
  const run = creation.run;
  stages.push(stage("evaluation", "pass", "후보 평가 순서 생성", `${run.candidates.length}개 후보 · 시설 우선순위 → 시간 우선순위`));

  const observation: AtomicAvailabilityObservation = {
    eventId: "fixtureobservation01",
    observedAt: new Date(now.getTime() + 10).toISOString(),
    facilities: input.facilityIds.map((facilityId, index) => ({
      facilityId,
      availability: availabilityFor(scenario, input.requestedTimes, index)
    }))
  };
  run.observeAtomic(observation, new Date(now.getTime() + 10));
  if (!run.selected) {
    run.closeAvailability(new Date(now.getTime() + 20));
    stages.push(stage("selection", "stop", "선택된 후보 없음", run.reasonCode));
    return { outcome: "stopped", reasonCode: run.reasonCode, candidates: [...run.candidates], stages, safeTrace: JSON.parse(JSON.stringify(run)) };
  }
  stages.push(stage("selection", "pass", "예약 가능 후보 선택", `F${run.selected.facilityPriority} / T${run.selected.timePriority} · ${run.selected.startTime}~${run.selected.endTime}`));

  const lock = new MemoryExecutionLock();
  if (!run.acquireExecutionLock(lock, new Date(now.getTime() + 20))) {
    stages.push(stage("lock", "stop", "실행 잠금 실패", run.reasonCode));
    return { outcome: "stopped", reasonCode: run.reasonCode, candidates: [...run.candidates], selected: run.selected, stages, safeTrace: JSON.parse(JSON.stringify(run)) };
  }
  stages.push(stage("lock", "pass", "1회 실행 잠금 획득", "나머지 후보는 이 실행에서 제외"));

  const binding = run.selectedBinding();
  if (!binding || !run.enterOfficialCalendar() || !run.markOfficialSessionSelected(binding) || !run.enterOfficialForm()) {
    throw new Error("오프라인 실행 상태를 준비하지 못했습니다.");
  }
  const intent = createOnDeviceReservationIntent({
    facilityId: run.selected.facilityId,
    facilityName: FIXTURE_FACILITIES.find(({ id }) => id === run.selected?.facilityId)?.name ?? "오프라인 시설",
    date: input.date,
    selectedTime: run.selected.requestedTime,
    selectedSlot: { id: run.selected.sessionId, startTime: run.selected.startTime, endTime: run.selected.endTime }
  }, now);
  const inputStore = new MemoryEphemeralReservationStore();
  inputStore.save(createEphemeralReservationInput({
    child: input.child,
    residence: input.residence,
    guardianCount: input.guardianTotal,
    approvedAgreements: agreementVersions.map((agreement) => ({ ...agreement, approvedAt: now.toISOString(), userApproved: true as const }))
  }, now), now);
  const authorizationStore = new OneTimeSubmitAuthorizationStore();
  authorizationStore.authorize({ reservationButtonAuthorized: true, authorizationId, binding, agreementVersions }, now);
  const writtenFields = new Set<string>();
  let fixtureSubmitCount = 0;
  const writer = {
    setField(fieldId: string, _value: string) { writtenFields.add(fieldId); },
    submit() { fixtureSubmitCount += 1; }
  };
  const review: FixtureReviewObservation = {
    url: `https://umppa.seoul.go.kr${KNOWN_REVIEW_FORM_PATH}`,
    screenId: scenario === "popup_unknown" ? "unknown_fixture_screen" : KNOWN_REVIEW_SCREEN_ID,
    form: { id: KNOWN_REVIEW_FORM_ID, action: KNOWN_REVIEW_FORM_PATH, method: "POST", submitControlId: KNOWN_SUBMIT_CONTROL_ID },
    reservation: binding,
    displayedAgreements: agreementVersions,
    validationErrors: scenario === "validation_error" ? ["fixture_required_field"] : [],
    flow: { payment: false, care: false, group: false, waitlist: false, cancellation: false }
  };

  if (scenario === "popup_unknown" || scenario === "validation_error") {
    const stopped = executeFixtureReservationSubmit({ capability: FIXTURE_SUBMIT_CAPABILITY, authorizationStore, inputStore, intent, observation: review, writer, now: new Date(now.getTime() + 30) });
    const reasonCode = stopped.action === "stop" ? stopped.reasonCode : "fixture_stop_failed";
    stages.push(stage("form", "stop", "폼 작성 중지", reasonCode));
    stages.push(stage("dispatch", "stop", "오프라인 제출 없음", "필드 기록 0 · 제출 0"));
    return { outcome: "stopped", reasonCode, candidates: [...run.candidates], selected: run.selected, stages, safeTrace: JSON.parse(JSON.stringify(run)) };
  }

  run.verifyOfficialReview(binding);
  let protocolReason = "none";
  const dispatchFixture = () => {
    const result = executeFixtureReservationSubmit({ capability: FIXTURE_SUBMIT_CAPABILITY, authorizationStore, inputStore, intent, observation: review, writer, now: new Date(now.getTime() + 30) });
    if (result.action === "stop") {
      protocolReason = result.reasonCode;
      throw new Error("fixture_protocol_stopped");
    }
    if (scenario === "post_submit_ambiguity") throw new Error("fixture_post_submit_disconnect");
  };
  const attempts = scenario === "double_click_replay"
    ? await Promise.all([run.dispatchOnce(dispatchFixture), run.dispatchOnce(dispatchFixture)])
    : [await run.dispatchOnce(dispatchFixture)];
  stages.push(stage("form", writtenFields.size > 0 ? "pass" : "stop", "오프라인 폼 작성", `${writtenFields.size}개 허용 필드 작성 · 개인 값 미표시`));
  stages.push(stage("dispatch", fixtureSubmitCount === 1 ? "pass" : "stop", "오프라인 fixture-submit 발송", `제출 횟수 ${fixtureSubmitCount} · 라이브 요청 0`));
  if (scenario === "double_click_replay") {
    const blocked = attempts.filter((attempt) => !attempt.dispatched).length;
    stages.push(stage("replay", blocked === 1 ? "pass" : "stop", "재실행 차단", `2개 요청 중 ${blocked}개 차단 · fixture-submit ${fixtureSubmitCount}회`));
  }
  if (scenario === "post_submit_ambiguity" || run.state === "CONFIRMATION_REQUIRED") {
    stages.push(stage("completion", "pending", "완료 확인 필요", "제출 후 결과가 불명하며 자동 재시도하지 않음"));
    stages.push(stage("list", "pending", "예약 내역 수동 확인", "성공으로 표시하지 않음"));
    return { outcome: "confirmation_required", reasonCode: run.reasonCode || protocolReason, candidates: [...run.candidates], selected: run.selected, stages, safeTrace: JSON.parse(JSON.stringify(run)) };
  }

  const completionId = "fixturecompletion01";
  run.verifyCompletion({
    officialCompletion: { binding, completionId },
    reservationList: [{ binding, completionId }]
  });
  stages.push(stage("completion", run.state === "SUCCEEDED" ? "pass" : "pending", "완료 화면 검증", run.state === "SUCCEEDED" ? "선택 바인딩 일치" : run.reasonCode));
  stages.push(stage("list", run.state === "SUCCEEDED" ? "pass" : "pending", "예약 내역 교차 검증", run.state === "SUCCEEDED" ? "단일 일치 기록 확인" : run.reasonCode));
  return { outcome: run.state === "SUCCEEDED" ? "succeeded" : "confirmation_required", reasonCode: run.reasonCode, candidates: [...run.candidates], selected: run.selected, stages, safeTrace: JSON.parse(JSON.stringify(run)) };
}
