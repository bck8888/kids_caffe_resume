import assert from "node:assert/strict";
import test from "node:test";
import { createOnDeviceReservationIntent } from "./assistant-protocol.ts";
import {
  executeFixtureReservationSubmit,
  FIXTURE_SUBMIT_CAPABILITY,
  KNOWN_REVIEW_FORM_ID,
  KNOWN_REVIEW_FORM_PATH,
  KNOWN_REVIEW_SCREEN_ID,
  KNOWN_SUBMIT_CONTROL_ID,
  OneTimeSubmitAuthorizationStore,
  type FixtureReviewObservation,
  type ReservationExecutionBinding
} from "./fixture-submit-protocol.ts";
import { createEphemeralReservationInput, MemoryEphemeralReservationStore } from "../privacy/reservation-privacy.ts";

const now = new Date("2026-09-06T03:00:00.000Z");
const agreements = [
  { agreementId: "sms_receipt" as const, version: "2026-09-01" },
  { agreementId: "personal_data" as const, version: "2026-09-01" },
  { agreementId: "terms" as const, version: "2026-09-01" }
];
const binding: ReservationExecutionBinding = {
  facilityId: "SC240404", date: "2026-09-06", slotId: "slot-2", party: { childCount: 1, guardianCount: 2 }
};
const intent = createOnDeviceReservationIntent({
  facilityId: binding.facilityId,
  facilityName: "서울형 키즈카페",
  date: binding.date,
  selectedTime: "14:30",
  selectedSlot: { id: binding.slotId, startTime: "14:00", endTime: "16:00" }
}, now);

const observation = (): FixtureReviewObservation => ({
  url: `https://umppa.seoul.go.kr${KNOWN_REVIEW_FORM_PATH}`,
  screenId: KNOWN_REVIEW_SCREEN_ID,
  form: {
    id: KNOWN_REVIEW_FORM_ID,
    action: KNOWN_REVIEW_FORM_PATH,
    method: "POST",
    submitControlId: KNOWN_SUBMIT_CONTROL_ID
  },
  reservation: structuredClone(binding),
  displayedAgreements: structuredClone(agreements),
  validationErrors: [],
  flow: { payment: false, care: false, group: false, waitlist: false, cancellation: false }
});

function setup() {
  const inputStore = new MemoryEphemeralReservationStore();
  inputStore.save(createEphemeralReservationInput({
    child: { name: "테스트 아동", birthYear: 2021, birthMonth: 5, sex: "female" },
    residence: { branch: "seoul", districtCode: "11650", neighborhoodCode: "SC-01" },
    guardianCount: 2,
    approvedAgreements: agreements.map((agreement) => ({
      ...agreement, approvedAt: "2026-09-06T02:59:00.000Z", userApproved: true as const
    }))
  }, now), now);
  const authorizationStore = new OneTimeSubmitAuthorizationStore();
  authorizationStore.authorize({
    reservationButtonAuthorized: true,
    authorizationId: "fixture-auth-0001",
    binding,
    agreementVersions: agreements
  }, now);
  const calls: Array<{ operation: string; field?: string; value?: string }> = [];
  const writer = {
    setField(field: string, value: string) { calls.push({ operation: "setField", field, value }); },
    submit(formId: typeof KNOWN_REVIEW_FORM_ID, controlId: typeof KNOWN_SUBMIT_CONTROL_ID) {
      calls.push({ operation: "submit", field: formId, value: controlId });
    }
  };
  return { inputStore, authorizationStore, writer, calls };
}

function execute(change: Partial<Parameters<typeof executeFixtureReservationSubmit>[0]> = {}) {
  const state = setup();
  const result = executeFixtureReservationSubmit({
    capability: FIXTURE_SUBMIT_CAPABILITY,
    authorizationStore: state.authorizationStore,
    inputStore: state.inputStore,
    intent,
    observation: observation(),
    writer: state.writer,
    now: new Date("2026-09-06T03:00:30.000Z"),
    ...change
  });
  return { ...state, result };
}

test("one explicit authorization fills the fixture form and dispatches its exact submit control", () => {
  const { result, calls, inputStore } = execute();
  assert.deepEqual(result, { action: "submit_reservation", outcome: "fixture_dispatched", authorizationConsumed: true });
  assert.deepEqual(calls.at(-1), { operation: "submit", field: KNOWN_REVIEW_FORM_ID, value: KNOWN_SUBMIT_CONTROL_ID });
  assert.ok(calls.some((call) => call.field === "childName" && call.value === "테스트 아동"));
  assert.equal(inputStore.load(now), undefined);
});

test("authorization is consumed before dispatch and cannot be replayed", () => {
  const state = setup();
  const args = { capability: FIXTURE_SUBMIT_CAPABILITY, authorizationStore: state.authorizationStore, inputStore: state.inputStore, intent, observation: observation(), writer: state.writer, now } as const;
  assert.equal(executeFixtureReservationSubmit(args).action, "submit_reservation");
  assert.deepEqual(executeFixtureReservationSubmit(args), { action: "stop", outcome: "stopped", reasonCode: "authorization_missing_or_expired", authorizationConsumed: false });
  assert.equal(state.calls.filter((call) => call.operation === "submit").length, 1);
});

test("authorization requires the explicit button signal and every versioned agreement", () => {
  const store = new OneTimeSubmitAuthorizationStore();
  assert.throws(() => store.authorize({
    reservationButtonAuthorized: false,
    authorizationId: "fixture-auth-0001",
    binding,
    agreementVersions: agreements
  } as never, now), /Explicit reservation-button/);
  assert.throws(() => store.authorize({
    reservationButtonAuthorized: true,
    authorizationId: "fixture-auth-0001",
    binding,
    agreementVersions: agreements.slice(0, 2)
  }, now), /Every required agreement/);
});

test("expired authorization is burned without page writes", () => {
  const state = setup();
  const result = executeFixtureReservationSubmit({ capability: FIXTURE_SUBMIT_CAPABILITY, authorizationStore: state.authorizationStore, inputStore: state.inputStore, intent, observation: observation(), writer: state.writer, now: new Date("2026-09-06T03:02:00.000Z") });
  assert.equal(result.action, "stop");
  assert.equal(state.calls.length, 0);
  assert.equal(state.authorizationStore.consume(now), undefined);
});

test("connected capability is disabled and consumes the attempt", () => {
  const { result, calls } = execute({ capability: "connected_submit_disabled" });
  assert.equal(result.action, "stop");
  assert.equal(result.action === "stop" && result.reasonCode, "connected_submit_disabled");
  assert.equal(calls.length, 0);
});

test("origin, review path, screen, form, method, and submit identity are exact gates", () => {
  const variants: Array<[string, (value: FixtureReviewObservation) => void]> = [
    ["origin", (value) => { value.url = `https://example.com${KNOWN_REVIEW_FORM_PATH}`; }],
    ["path", (value) => { value.url = "https://umppa.seoul.go.kr/icare/changed"; }],
    ["screen", (value) => { value.screenId = "unknown"; }],
    ["form", (value) => { value.form.id = "other"; }],
    ["method", (value) => { value.form.method = "GET"; }],
    ["action", (value) => { value.form.action = "https://example.com/submit"; }],
    ["control", (value) => { value.form.submitControlId = "other"; }]
  ];
  for (const [label, mutate] of variants) {
    const changed = observation();
    mutate(changed);
    const { result, calls } = execute({ observation: changed });
    assert.equal(result.action, "stop", label);
    assert.equal(calls.length, 0, label);
  }
});

test("facility, date, slot, and party mismatches all stop", () => {
  for (const key of ["facilityId", "date", "slotId", "party"] as const) {
    const changed = observation();
    if (key === "party") changed.reservation.party.guardianCount = 3;
    else changed.reservation[key] += "-changed";
    const { result, calls } = execute({ observation: changed });
    assert.equal(result.action, "stop", key);
    assert.equal(result.action === "stop" && result.reasonCode, "intent_mismatch", key);
    assert.equal(calls.length, 0, key);
  }
});

test("missing or differently versioned required agreements stop", () => {
  for (const displayedAgreements of [agreements.slice(0, 2), agreements.map((item, index) => index === 1 ? { ...item, version: "changed" } : item)]) {
    const changed = observation();
    changed.displayedAgreements = displayedAgreements;
    const { result, calls } = execute({ observation: changed });
    assert.equal(result.action, "stop");
    assert.equal(result.action === "stop" && result.reasonCode, "agreement_missing_or_version_mismatch");
    assert.equal(calls.length, 0);
  }
});

test("pending validation and every excluded flow stop", () => {
  const pending = observation();
  pending.validationErrors = ["required"];
  assert.equal(execute({ observation: pending }).result.action, "stop");
  for (const flow of ["payment", "care", "group", "waitlist", "cancellation"] as const) {
    const changed = observation();
    changed.flow[flow] = true;
    const { result, calls } = execute({ observation: changed });
    assert.equal(result.action, "stop", flow);
    assert.equal(result.action === "stop" && result.reasonCode, "excluded_flow", flow);
    assert.equal(calls.length, 0, flow);
  }
});

test("stores and results serialize without personal reservation values", () => {
  const state = setup();
  const serializedBefore = JSON.stringify({ authorization: state.authorizationStore, input: state.inputStore });
  assert.equal(serializedBefore.includes("테스트 아동"), false);
  assert.equal(serializedBefore.includes("2021"), false);
  const result = executeFixtureReservationSubmit({ capability: FIXTURE_SUBMIT_CAPABILITY, authorizationStore: state.authorizationStore, inputStore: state.inputStore, intent, observation: observation(), writer: state.writer, now });
  const serializedResult = JSON.stringify(result);
  assert.equal(serializedResult.includes("테스트 아동"), false);
  assert.equal(serializedResult.includes("11650"), false);
});
