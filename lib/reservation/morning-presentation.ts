import type { FixtureScenarioId, MorningFixtureResult } from "./morning-fixture";

export const PRODUCT_NAME = "아이랑 서울";
export const THEME_STORAGE_KEY = "irang-seoul-theme";
export const THEME_VALUES = ["system", "light", "dark"] as const;
export type ThemePreference = typeof THEME_VALUES[number];

export const JOURNEY_STEPS = [
  { id: 1, short: "조건", title: "어디로, 언제 갈까요?" },
  { id: 2, short: "가족 정보", title: "예약에 필요한 정보예요" },
  { id: 3, short: "확인", title: "마지막으로 확인해 주세요" }
] as const;

export const DISTRICTS = [
  { label: "서초구", code: "11650", neighborhoods: [{ label: "서초동", code: "SEOUL-01" }, { label: "방배동", code: "SEOUL-02" }] },
  { label: "강동구", code: "11740", neighborhoods: [{ label: "천호동", code: "SEOUL-03" }, { label: "상일동", code: "SEOUL-04" }] }
] as const;

export const OUTSIDE_AREAS = [
  { label: "경기도 성남시", provinceCode: "GYEONGGI", localAuthorityCode: "SEONGNAM" },
  { label: "경기도 하남시", provinceCode: "GYEONGGI", localAuthorityCode: "HANAM" },
  { label: "인천광역시", provinceCode: "INCHEON", localAuthorityCode: "INCHEON" }
] as const;

type ResultPresentation = {
  tone: "success" | "unavailable" | "holiday" | "confirmation" | "stopped";
  eyebrow: string;
  title: string;
  message: string;
  next: string;
};

export function presentFixtureResult(result: Pick<MorningFixtureResult, "outcome" | "reasonCode">): ResultPresentation {
  if (result.outcome === "succeeded") return {
    tone: "success",
    eyebrow: "연습이 잘 끝났어요",
    title: "선택한 조건으로 한 번 확인했어요",
    message: "테스트 환경에서 예약 가능 후보 하나를 골라 완료 확인까지 마쳤어요.",
    next: "실제 예약은 진행되지 않았어요. 입력을 바꾸거나 다른 테스트 상황을 확인할 수 있어요."
  };
  if (result.reasonCode === "availability_unavailable") return {
    tone: "unavailable",
    eyebrow: "현재 자리가 없어요",
    title: "선택한 조건으로는 예약하기 어려워요",
    message: "첫 번째 장소부터 순서대로 확인했지만 가능한 시간이 없었어요.",
    next: "이전 단계로 돌아가 다른 시간이나 두 번째 장소를 골라 보세요."
  };
  if (result.reasonCode === "availability_explicit_holiday") return {
    tone: "holiday",
    eyebrow: "쉬는 날이에요",
    title: "선택한 날짜에는 운영하지 않아요",
    message: "휴관으로 안내된 날이라 예약 시도를 시작하지 않았어요.",
    next: "이전 단계에서 다른 날짜를 선택해 주세요."
  };
  if (result.outcome === "confirmation_required" || result.reasonCode === "availability_ambiguous") return {
    tone: "confirmation",
    eyebrow: "확인이 더 필요해요",
    title: result.reasonCode === "availability_ambiguous" ? "예약 가능 여부를 확실히 알 수 없어요" : "완료 여부를 바로 확인하지 못했어요",
    message: result.reasonCode === "availability_ambiguous" ? "빈 응답만으로 매진이나 휴관이라고 판단하지 않았어요." : "한 번의 시도 뒤 결과가 분명하지 않아 다시 시도하지 않았어요.",
    next: "자동으로 다시 시도하지 않아요. 실제 서비스에서는 공식 예약 내역에서 직접 확인해야 해요."
  };
  return {
    tone: "stopped",
    eyebrow: "안전하게 멈췄어요",
    title: "예약 연습을 계속하지 않았어요",
    message: "예상하지 못한 화면이나 확인할 항목이 있어 입력과 시도를 중단했어요.",
    next: "개발 패널에서 원인을 확인한 뒤 처음부터 다시 검토해 주세요."
  };
}

export function scenarioCopy(scenario: FixtureScenarioId) {
  return scenario;
}
