import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURE_SCENARIOS, runMorningFixture, type MorningFixtureInput } from "./morning-fixture.ts";

const now = new Date("2026-09-06T08:00:00.000Z");
const input: MorningFixtureInput = {
  date: "2026-09-07",
  facilityIds: ["FXCAFE01", "FXCAFE02"],
  requestedTimes: ["10:00", "14:00"],
  child: { name: "CANARY_CHILD", birthYear: 2021, birthMonth: 5, sex: "female" },
  residence: { branch: "seoul", districtCode: "CANARY_DISTRICT", neighborhoodCode: "CANARY_NEIGHBORHOOD" },
  guardianTotal: 2,
  approvedAgreementIds: ["sms_receipt", "personal_data", "terms"]
};

test("success evaluates deterministic 2x2 order, submits once, and verifies completion plus list", async () => {
  const result = await runMorningFixture("success", structuredClone(input), now);
  assert.equal(result.outcome, "succeeded");
  assert.deepEqual(result.candidates.map(({ facilityPriority, timePriority }) => [facilityPriority, timePriority]), [[1, 1], [1, 2], [2, 1], [2, 2]]);
  assert.equal(result.selected?.key, "FXCAFE01::10:00");
  assert.equal(result.stages.find(({ id }) => id === "dispatch")?.detail.includes("제출 횟수 1"), true);
  assert.equal(result.stages.find(({ id }) => id === "completion")?.status, "pass");
  assert.equal(result.stages.find(({ id }) => id === "list")?.status, "pass");
});

test("every required morning scenario is present", () => {
  assert.deepEqual(FIXTURE_SCENARIOS.map(({ id }) => id), [
    "success", "all_unavailable", "holiday", "ambiguous_unavailable", "popup_unknown",
    "validation_error", "post_submit_ambiguity", "double_click_replay"
  ]);
});

test("unavailable, holiday, and ambiguous fixture results remain distinct", async () => {
  const unavailable = await runMorningFixture("all_unavailable", structuredClone(input), now);
  const holiday = await runMorningFixture("holiday", structuredClone(input), now);
  const ambiguous = await runMorningFixture("ambiguous_unavailable", structuredClone(input), now);
  assert.equal(unavailable.reasonCode, "availability_unavailable");
  assert.equal(holiday.reasonCode, "availability_explicit_holiday");
  assert.equal(ambiguous.reasonCode, "availability_ambiguous");
  assert.equal(unavailable.stages.some(({ id }) => id === "dispatch"), false);
  assert.equal(holiday.stages.some(({ id }) => id === "dispatch"), false);
  assert.equal(ambiguous.stages.some(({ id }) => id === "dispatch"), false);
});

test("unknown screen and validation error stop before any fixture field write or submit", async () => {
  for (const scenario of ["popup_unknown", "validation_error"] as const) {
    const result = await runMorningFixture(scenario, structuredClone(input), now);
    assert.equal(result.outcome, "stopped");
    assert.equal(result.stages.find(({ id }) => id === "form")?.status, "stop");
    assert.equal(result.stages.find(({ id }) => id === "dispatch")?.detail, "필드 기록 0 · 제출 0");
  }
});

test("post-submit ambiguity requires confirmation and never claims completion", async () => {
  const result = await runMorningFixture("post_submit_ambiguity", structuredClone(input), now);
  assert.equal(result.outcome, "confirmation_required");
  assert.equal(result.reasonCode, "dispatch_ambiguous");
  assert.equal(result.stages.find(({ id }) => id === "dispatch")?.detail.includes("제출 횟수 1"), true);
  assert.equal(result.stages.find(({ id }) => id === "completion")?.status, "pending");
  assert.equal(result.stages.find(({ id }) => id === "list")?.status, "pending");
});

test("double-click/replay still produces exactly one fixture submit", async () => {
  const result = await runMorningFixture("double_click_replay", structuredClone(input), now);
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.stages.find(({ id }) => id === "replay")?.status, "pass");
  assert.equal(result.stages.find(({ id }) => id === "replay")?.detail, "2개 요청 중 1개 차단 · fixture-submit 1회");
});

test("safe result and trace never render personal fixture values", async () => {
  const result = await runMorningFixture("success", structuredClone(input), now);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("CANARY_CHILD"), false);
  assert.equal(serialized.includes("CANARY_DISTRICT"), false);
  assert.equal(serialized.includes("CANARY_NEIGHBORHOOD"), false);
});

test("duplicate priorities and missing explicit version approvals reject before execution", async () => {
  await assert.rejects(runMorningFixture("success", { ...structuredClone(input), facilityIds: ["FXCAFE01", "FXCAFE01"] }, now), /시설 우선순위/);
  await assert.rejects(runMorningFixture("success", { ...structuredClone(input), approvedAgreementIds: ["sms_receipt", "personal_data"] }, now), /3개 약관/);
});
