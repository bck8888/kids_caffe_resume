import assert from "node:assert/strict";
import test from "node:test";
import {
  createEphemeralReservationInput,
  MemoryEphemeralReservationStore,
  sanitizeOperationalEvent
} from "./reservation-privacy.ts";

const now = new Date("2026-09-06T03:00:00.000Z");
const input = {
  child: { name: "테스트 아동", birthYear: 2021, birthMonth: 5, sex: "female" as const },
  residence: { branch: "seoul" as const, districtCode: "11650", neighborhoodCode: "SC-01" },
  guardianCount: 2,
  approvedAgreements: [
    { agreementId: "personal_data" as const, version: "2026-09-01", approvedAt: "2026-09-06T02:59:00.000Z", userApproved: true as const }
  ]
};

test("accepts only the explicit immediate-action reservation contract", () => {
  const value = createEphemeralReservationInput(input, now);
  assert.equal(value.child.birthMonth, 5);
  assert.equal(value.residence.branch, "seoul");
  assert.deepEqual(value.approvedAgreements.map(({ agreementId, version, approvedAt }) => ({ agreementId, version, approvedAt })), [
    { agreementId: "personal_data", version: "2026-09-01", approvedAt: "2026-09-06T02:59:00.000Z" }
  ]);
});

test("rejects credentials, auth material, health data, captured UI, and unknown fields", () => {
  for (const forbidden of [
    { password: "secret" }, { one_time_password: "123456" }, { sessionToken: "token" },
    { cookies: "sid=x" }, { resident_registration_number: "x" }, { disabilityData: "x" },
    { full_DOM: "<html>" }, { screen_shot: "bytes" }
  ]) {
    assert.throws(() => createEphemeralReservationInput({ ...input, nested: forbidden } as never, now), /not allowed|unsupported key/);
  }
  assert.throws(() => createEphemeralReservationInput({ ...input, approvedAgreements: [{ ...input.approvedAgreements[0], userApproved: false }] } as never, now), /explicit user approval/);
});

test("expires, explicitly clears, and consumes the memory-only value once", () => {
  const store = new MemoryEphemeralReservationStore();
  store.save(createEphemeralReservationInput(input, now), now);
  assert.equal(store.load(new Date("2026-09-06T03:14:59.000Z"))?.child.name, "테스트 아동");
  assert.equal(store.load(new Date("2026-09-06T03:15:00.000Z")), undefined);
  store.save(createEphemeralReservationInput(input, now), now);
  assert.ok(store.consume(now));
  assert.equal(store.consume(now), undefined);
  store.save(createEphemeralReservationInput(input, now), now);
  store.clear();
  assert.equal(store.load(now), undefined);
});

test("store serialization and sanitized events never leak reservation input", () => {
  const store = new MemoryEphemeralReservationStore();
  store.save(createEphemeralReservationInput(input, now), now);
  const serializedStore = JSON.stringify(store);
  assert.equal(serializedStore.includes("테스트 아동"), false);
  assert.equal(serializedStore.includes("2021"), false);

  const event = sanitizeOperationalEvent({
    name: "assistant_stopped", outcome: "stopped", reasonCode: "unknown_screen", harmlessExtra: "discarded"
  });
  assert.deepEqual(Object.keys(event), ["schemaVersion", "name", "outcome", "reasonCode"]);
  assert.equal(JSON.stringify(event).includes("harmlessExtra"), false);
});

test("sanitizer rejects nested and alias-like sensitive keys before projection", () => {
  for (const nested of [
    { context: { child_nm: "x" } },
    { payload: [{ birth_year: 2021 }] },
    { debug: { auth_token: "x" } },
    { capture: { inner_HTML: "<form>" } },
    { profile: { guardian_count: 2 } }
  ]) {
    assert.throws(() => sanitizeOperationalEvent({ name: "assistant_stopped", outcome: "stopped", ...nested }), /Sensitive key/);
  }
});
