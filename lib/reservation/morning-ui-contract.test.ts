import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../../app/morning-review.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("the primary page progressively reveals exactly three customer steps", () => {
  assert.equal((component.match(/className="journey-step/g) ?? []).length, 3);
  assert.match(component, /hidden=\{step !== 1\}/);
  assert.match(component, /hidden=\{step !== 2\}/);
  assert.match(component, /hidden=\{step !== 3\}/);
  assert.equal(component.includes("자치구 코드"), false);
  assert.equal(component.includes("행정동 코드"), false);
  assert.equal(component.includes("F1\/T1"), false);
});

test("technical fixture controls and trace stay inside the collapsed development panel", () => {
  const panel = component.slice(component.indexOf("<details className=\"developer-panel\""));
  assert.match(panel, /재현할 상황/);
  assert.match(panel, /픽스처 버전/);
  assert.match(panel, /공식 제출 비활성화/);
  assert.match(panel, /safe-trace/);
  assert.equal((component.match(/className="developer-panel"/g) ?? []).length, 1);
});

test("theme CSS exposes system, explicit light and dark, focus, touch and reduced-motion contracts", () => {
  assert.match(styles, /@media \(prefers-color-scheme: dark\)/);
  assert.match(styles, /:root\[data-theme="light"\]/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: dark/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /min-height: 44px/);
});

test("only the final step mounts the sticky one-attempt authorization", () => {
  assert.match(component, /step === 3 && !result && <div className="sticky-authorization"/);
  assert.equal((component.match(/className="sticky-authorization"/g) ?? []).length, 1);
  assert.match(component, /이 조건으로 1회 예약 시도/);
  assert.match(component, /자동 재시도 없음/);
});
