import assert from "node:assert/strict";
import test from "node:test";
import { JOURNEY_STEPS, PRODUCT_NAME, THEME_STORAGE_KEY, THEME_VALUES, presentFixtureResult } from "./morning-presentation.ts";

test("consumer journey has three plain-language steps and a consistent product name", () => {
  assert.equal(PRODUCT_NAME, "아이랑 서울");
  assert.deepEqual(JOURNEY_STEPS.map(({ short }) => short), ["조건", "가족 정보", "확인"]);
  assert.equal(JSON.stringify(JOURNEY_STEPS).includes("F1"), false);
  assert.equal(JSON.stringify(JOURNEY_STEPS).includes("T1"), false);
});

test("theme contract supports system default plus explicit light and dark preferences", () => {
  assert.equal(THEME_STORAGE_KEY, "irang-seoul-theme");
  assert.deepEqual(THEME_VALUES, ["system", "light", "dark"]);
});

test("result presentation keeps unavailable, holiday, and confirmation states distinct", () => {
  const unavailable = presentFixtureResult({ outcome: "stopped", reasonCode: "availability_unavailable" });
  const holiday = presentFixtureResult({ outcome: "stopped", reasonCode: "availability_explicit_holiday" });
  const ambiguous = presentFixtureResult({ outcome: "stopped", reasonCode: "availability_ambiguous" });
  const postSubmit = presentFixtureResult({ outcome: "confirmation_required", reasonCode: "dispatch_ambiguous" });
  assert.deepEqual([unavailable.tone, holiday.tone, ambiguous.tone, postSubmit.tone], ["unavailable", "holiday", "confirmation", "confirmation"]);
  assert.notEqual(unavailable.title, holiday.title);
  assert.match(ambiguous.next, /다시 시도하지 않아요/);
  assert.match(postSubmit.next, /공식 예약 내역/);
});

test("customer result copy is privacy-safe and contains no internal fixture identifiers", () => {
  const serialized = JSON.stringify([
    presentFixtureResult({ outcome: "succeeded", reasonCode: "none" }),
    presentFixtureResult({ outcome: "stopped", reasonCode: "availability_unavailable" }),
    presentFixtureResult({ outcome: "confirmation_required", reasonCode: "dispatch_ambiguous" })
  ]);
  for (const forbidden of ["CANARY_CHILD", "CANARY_DISTRICT", "FXCAFE", "fixture-submit", "F1", "T1"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
