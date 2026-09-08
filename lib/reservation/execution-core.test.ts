import assert from "node:assert/strict";
import test from "node:test";
import {
  AVAILABILITY_DEADLINE_MS,
  createCandidateMatrix,
  createReservationExecutionRun,
  deriveGuardianTotal,
  MemoryExecutionLock,
  type AtomicAvailabilityObservation,
  type ExecutionRequest,
  type FacilityAvailability,
  type FacilityGuardianRule,
  type ReservationExecutionRun
} from "./execution-core.ts";
import { createOnDeviceReservationIntent } from "../on-device/assistant-protocol.ts";
import {
  executeFixtureReservationSubmit,
  FIXTURE_SUBMIT_CAPABILITY,
  KNOWN_REVIEW_FORM_ID,
  KNOWN_REVIEW_FORM_PATH,
  KNOWN_REVIEW_SCREEN_ID,
  KNOWN_SUBMIT_CONTROL_ID,
  OneTimeSubmitAuthorizationStore
} from "../on-device/fixture-submit-protocol.ts";
import { createEphemeralReservationInput, MemoryEphemeralReservationStore } from "../privacy/reservation-privacy.ts";

const now = new Date("2026-09-06T03:00:00.000Z");
const later = (milliseconds: number) => new Date(now.getTime() + milliseconds);

function guardianRule(facilityId: string, overrides: Partial<FacilityGuardianRule> = {}): FacilityGuardianRule {
  return {
    facilityId,
    status: "confirmed",
    includesApplicant: true,
    maxGuardianTotal: 2,
    observedAt: "2026-09-06T02:00:00.000Z",
    expiresAt: "2026-09-07T02:00:00.000Z",
    ...overrides
  };
}

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    requestId: "request_0001",
    authorizationId: "authorization_0001",
    authorizationIssuedAt: now.toISOString(),
    authorizationExpiresAt: later(120_000).toISOString(),
    date: "2026-09-20",
    facilityIds: ["F1", "F2"],
    requestedTimes: ["10:30", "14:30"],
    childCount: 1,
    accompanyingGuardianCount: 1,
    guardianRules: [guardianRule("F1"), guardianRule("F2")],
    ...overrides
  };
}

function run(overrides: Partial<ExecutionRequest> = {}) {
  const created = createReservationExecutionRun(request(overrides), now);
  if (!created.ok) throw new Error(created.reasonCode);
  return created.run;
}

const sessions = () => [
  { sessionId: "S1", startTime: "10:00", endTime: "12:00", useType: "individual", remainingCapacity: 1 },
  { sessionId: "S2", startTime: "14:00", endTime: "16:00", useType: "individual", remainingCapacity: 2 }
];

function event(eventId: string, facilities: AtomicAvailabilityObservation["facilities"], observedAt = later(100).toISOString()): AtomicAvailabilityObservation {
  return { eventId, observedAt, facilities };
}

function available(): FacilityAvailability { return { kind: "available", sessions: sessions() }; }

function selectAndLock(execution: ReservationExecutionRun, lock = new MemoryExecutionLock()) {
  execution.observeAtomic(event("event_0001", execution.candidates.map(({ facilityId }) => facilityId).filter((id, index, all) => all.indexOf(id) === index).map((facilityId) => ({ facilityId, availability: available() }))));
  assert.ok(execution.selected);
  assert.equal(execution.acquireExecutionLock(lock, later(200)), true);
  const binding = execution.selectedBinding();
  assert.ok(binding);
  assert.equal(execution.enterOfficialCalendar(), true);
  assert.equal(execution.markOfficialSessionSelected(binding), true);
  assert.equal(execution.enterOfficialForm(), true);
  assert.equal(execution.verifyOfficialReview(binding), true);
  return { binding, lock };
}

test("UT-004 ranks a simultaneous 2x2 observation by facility then time", () => {
  const execution = run();
  assert.deepEqual(execution.candidates.map(({ facilityId, requestedTime }) => [facilityId, requestedTime]), [
    ["F1", "10:30"], ["F1", "14:30"], ["F2", "10:30"], ["F2", "14:30"]
  ]);
  execution.observeAtomic(event("event_all", [
    { facilityId: "F2", availability: available() },
    { facilityId: "F1", availability: available() }
  ]));
  assert.equal(execution.selected?.key, "F1::10:30");
});

test("UT-005 first atomic observation with availability wins and later priority cannot replace it", () => {
  const execution = run();
  execution.observeAtomic(event("event_first", [{ facilityId: "F2", availability: { kind: "available", sessions: [sessions()[1]] } }]));
  assert.equal(execution.selected?.key, "F2::14:30");
  execution.observeAtomic(event("event_late", [{ facilityId: "F1", availability: available() }], later(200).toISOString()));
  assert.equal(execution.selected?.key, "F2::14:30");
  assert.equal(execution.trace.at(-1)?.reasonCode, "availability_response_late");
});

test("UT-006 omitted and duplicate optional choices create no fabricated candidates", () => {
  const one = run({ facilityIds: ["F1", "F1"], requestedTimes: ["10:30", "10:30"], guardianRules: [guardianRule("F1")] });
  assert.deepEqual(one.candidates.map(({ key }) => key), ["F1::10:30"]);
  const two = run({ facilityIds: ["F1"], requestedTimes: ["10:30", "14:30"], guardianRules: [guardianRule("F1")] });
  assert.deepEqual(two.candidates.map(({ key }) => key), ["F1::10:30", "F1::14:30"]);
  assert.equal(createCandidateMatrix({ facilityIds: ["F1", "F1"], requestedTimes: ["10:30"], guardianTotals: new Map([["F1", 1]]) }).length, 1);
});

test("UT-007 invalid and over-limit inputs fail before a run exists", () => {
  const cases: Array<[Partial<ExecutionRequest>, string]> = [
    [{ facilityIds: ["F1", "F2", "F3"], guardianRules: [guardianRule("F1"), guardianRule("F2"), guardianRule("F3")] }, "too_many_facilities"],
    [{ requestedTimes: ["09:00", "10:00", "11:00"] }, "too_many_requested_times"],
    [{ facilityIds: [] }, "invalid_facility"],
    [{ requestedTimes: [] }, "invalid_requested_time"],
    [{ requestedTimes: ["24:00"] }, "invalid_requested_time"],
    [{ date: "2026-02-30" }, "invalid_date"],
    [{ childCount: 2 as 1 }, "invalid_child_count"]
  ];
  for (const [overrides, reasonCode] of cases) {
    assert.deepEqual(createReservationExecutionRun(request(overrides), now), { ok: false, reasonCode });
  }
});

test("UT-008 derives official guardian total including applicant exactly once", () => {
  assert.deepEqual(deriveGuardianTotal("F1", 0, [guardianRule("F1")], now), { ok: true, guardianTotal: 1 });
  assert.deepEqual(deriveGuardianTotal("F1", 1, [guardianRule("F1")], now), { ok: true, guardianTotal: 2 });
  assert.equal(run({ accompanyingGuardianCount: 0 }).candidates[0].guardianTotal, 1);
});

test("UT-009 absent, stale, conflicting, mismatched, and over-capacity guardian rules fail closed", () => {
  const cases: Array<[FacilityGuardianRule[], string]> = [
    [[], "guardian_rule_missing"],
    [[guardianRule("F1", { expiresAt: now.toISOString() })], "guardian_rule_stale"],
    [[guardianRule("F1", { status: "conflicting" })], "guardian_rule_conflicting"],
    [[guardianRule("OTHER")], "guardian_rule_missing"],
    [[guardianRule("F1", { maxGuardianTotal: 1 })], "guardian_total_invalid"],
    [[guardianRule("F1"), guardianRule("F1")], "guardian_rule_conflicting"]
  ];
  for (const [guardianRules, reasonCode] of cases) {
    const result = createReservationExecutionRun(request({ facilityIds: ["F1"], guardianRules }), now);
    assert.deepEqual(result, { ok: false, reasonCode });
  }
});

test("availability statuses remain distinct and ambiguous empty data never becomes unavailable", () => {
  const statuses = ["explicit_holiday", "unavailable", "ambiguous", "expired", "timeout"] as const;
  for (const kind of statuses) {
    const execution = run({ facilityIds: ["F1"], requestedTimes: ["10:30"], guardianRules: [guardianRule("F1")] });
    execution.observeAtomic(event(`event_${kind}`, [{ facilityId: "F1", availability: { kind } }]));
    assert.equal(execution.candidateReason("F1::10:30"), `availability_${kind}`);
    execution.closeAvailability(later(AVAILABILITY_DEADLINE_MS));
    assert.equal(execution.reasonCode, `availability_${kind}`);
  }
});

test("session boundaries, capacity, use type, and overlapping matches are fail closed", () => {
  const atEnd = run({ facilityIds: ["F1"], requestedTimes: ["12:00"], guardianRules: [guardianRule("F1")] });
  atEnd.observeAtomic(event("event_end", [{ facilityId: "F1", availability: available() }]));
  assert.equal(atEnd.selected, undefined);
  assert.equal(atEnd.candidateReason("F1::12:00"), "availability_unavailable");

  for (const changed of [
    { ...sessions()[0], remainingCapacity: 0 },
    { ...sessions()[0], useType: "group" },
    { ...sessions()[0], startTime: "bad" }
  ]) {
    const execution = run({ facilityIds: ["F1"], requestedTimes: ["10:30"], guardianRules: [guardianRule("F1")] });
    execution.observeAtomic(event(`event_${changed.useType}_${changed.remainingCapacity}`, [{ facilityId: "F1", availability: { kind: "available", sessions: [changed] } }]));
    assert.equal(execution.selected, undefined);
  }

  const overlapping = run({ facilityIds: ["F1"], requestedTimes: ["10:30"], guardianRules: [guardianRule("F1")] });
  overlapping.observeAtomic(event("event_overlap", [{ facilityId: "F1", availability: { kind: "available", sessions: [sessions()[0], { ...sessions()[0], sessionId: "S3", startTime: "10:15" }] } }]));
  assert.equal(overlapping.candidateReason("F1::10:30"), "availability_ambiguous");
});

test("duplicate events and responses at the deadline are ignored deterministically", () => {
  const execution = run();
  execution.observeAtomic(event("event_same", [{ facilityId: "F2", availability: { kind: "unavailable" } }]));
  execution.observeAtomic(event("event_same", [{ facilityId: "F1", availability: available() }]));
  assert.equal(execution.selected, undefined);
  assert.equal(execution.trace.at(-1)?.reasonCode, "availability_event_duplicate");
  execution.observeAtomic(event("event_deadline", [{ facilityId: "F1", availability: available() }], later(AVAILABILITY_DEADLINE_MS).toISOString()), later(AVAILABILITY_DEADLINE_MS));
  assert.equal(execution.selected, undefined);
  assert.equal(execution.trace.at(-1)?.reasonCode, "availability_response_late");
});

test("a facility is observed at most once and an empty successful payload remains ambiguous", () => {
  const execution = run({ facilityIds: ["F1"], requestedTimes: ["10:30"], guardianRules: [guardianRule("F1")] });
  execution.observeAtomic(event("event_empty", [{ facilityId: "F1", availability: { kind: "available", sessions: [] } }]));
  assert.equal(execution.candidateReason("F1::10:30"), "availability_ambiguous");
  execution.observeAtomic(event("event_replayed_facility", [{ facilityId: "F1", availability: available() }], later(200).toISOString()));
  assert.equal(execution.selected, undefined);
  assert.equal(execution.candidateReason("F1::10:30"), "availability_ambiguous");
});

test("single-writer lock accepts one run and after lock no candidate fallback occurs", () => {
  const lock = new MemoryExecutionLock();
  const first = run();
  first.observeAtomic(event("event_one", [{ facilityId: "F2", availability: available() }]));
  assert.equal(first.acquireExecutionLock(lock, later(200)), true);
  const selected = first.selected?.key;

  const second = run({ authorizationId: "authorization_0002" });
  second.observeAtomic(event("event_two", [{ facilityId: "F1", availability: available() }]));
  assert.equal(second.acquireExecutionLock(lock, later(200)), false);
  assert.equal(second.reasonCode, "execution_lock_unavailable");

  assert.equal(first.enterOfficialCalendar(), true);
  assert.equal(first.markOfficialSessionSelected({ ...first.selectedBinding()!, slotId: "changed" }), false);
  assert.equal(first.state, "STOPPED_LOCKED");
  first.observeAtomic(event("event_fallback", [{ facilityId: "F1", availability: available() }]));
  assert.equal(first.selected?.key, selected);
});

test("authorization is valid strictly before expiry and cannot acquire a lock at expiry", () => {
  const before = run();
  before.observeAtomic(event("event_before_expiry", [{ facilityId: "F1", availability: available() }]));
  assert.equal(before.acquireExecutionLock(new MemoryExecutionLock(), later(119_999)), true);

  const atExpiry = run({ authorizationId: "authorization_expiry" });
  atExpiry.observeAtomic(event("event_at_expiry", [{ facilityId: "F1", availability: available() }]));
  assert.equal(atExpiry.acquireExecutionLock(new MemoryExecutionLock(), later(120_000)), false);
  assert.equal(atExpiry.state, "EXPIRED");
  assert.equal(atExpiry.reasonCode, "authorization_expired");
});

test("double-click and 100 concurrent replays dispatch exactly once", async () => {
  const execution = run();
  selectAndLock(execution);
  let dispatches = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const attempts = Array.from({ length: 100 }, () => execution.dispatchOnce(async () => { dispatches += 1; await gate; }));
  release();
  const results = await Promise.all(attempts);
  assert.equal(dispatches, 1);
  assert.equal(results.filter((result) => result.dispatched).length, 1);
  assert.equal(results.filter((result) => !result.dispatched && result.reasonCode === "dispatch_already_attempted").length, 99);
});

test("post-dispatch throw is ambiguous, never retries, and blocks a recreated request", async () => {
  const lock = new MemoryExecutionLock();
  const execution = run();
  selectAndLock(execution, lock);
  let calls = 0;
  const result = await execution.dispatchOnce(() => { calls += 1; throw new Error("network"); });
  assert.equal(result.reasonCode, "dispatch_ambiguous");
  assert.equal(execution.state, "CONFIRMATION_REQUIRED");
  assert.equal(lock.isAmbiguous("request_0001"), true);
  assert.equal((await execution.dispatchOnce(() => { calls += 1; })).dispatched, false);
  assert.equal(calls, 1);

  const retry = run({ authorizationId: "authorization_0002" });
  retry.observeAtomic(event("event_retry", [{ facilityId: "F1", availability: available() }]));
  assert.equal(retry.acquireExecutionLock(lock), false);
});

test("completion truthfully requires exact official evidence and one matching reservation-list record", async () => {
  const variants: Array<[string, (binding: NonNullable<ReturnType<ReservationExecutionRun["selectedBinding"]>>) => Parameters<ReservationExecutionRun["verifyCompletion"]>[0], string]> = [
    ["no completion", () => ({ officialCompletion: undefined, reservationList: [] }), "completion_evidence_missing"],
    ["completion only", (binding) => ({ officialCompletion: { binding, completionId: "C1" }, reservationList: [] }), "reservation_list_match_missing"],
    ["list only", (binding) => ({ officialCompletion: undefined, reservationList: [{ binding, completionId: "C1" }] }), "completion_evidence_missing"],
    ["mismatch", (binding) => ({ officialCompletion: { binding: { ...binding, slotId: "OTHER" }, completionId: "C1" }, reservationList: [{ binding, completionId: "C1" }] }), "verification_binding_mismatch"],
    ["duplicates", (binding) => ({ officialCompletion: { binding, completionId: "C1" }, reservationList: [{ binding, completionId: "C1" }, { binding, completionId: "C1" }] }), "reservation_list_match_conflicting"]
  ];
  for (const [label, evidence, reasonCode] of variants) {
    const execution = run({ requestId: `request_${label.replaceAll(" ", "_")}` });
    const { binding } = selectAndLock(execution);
    await execution.dispatchOnce(() => undefined);
    assert.equal(execution.verifyCompletion(evidence(binding)), false, label);
    assert.equal(execution.state, "CONFIRMATION_REQUIRED", label);
    assert.equal(execution.reasonCode, reasonCode, label);
  }

  const execution = run({ requestId: "request_success" });
  const { binding } = selectAndLock(execution);
  await execution.dispatchOnce(() => undefined);
  const evidence = { officialCompletion: { binding, completionId: "C1" }, reservationList: [{ binding, completionId: "C1" }] };
  assert.equal(execution.verifyCompletion(evidence), true);
  assert.equal(execution.state, "SUCCEEDED");
  assert.equal(execution.verifyCompletion(evidence), false);
});

test("execution state and trace serialize without request, authorization, facility, date, or time identifiers", async () => {
  const execution = run();
  const { binding } = selectAndLock(execution);
  await execution.dispatchOnce(() => undefined);
  execution.verifyCompletion({ officialCompletion: { binding, completionId: "C1" }, reservationList: [] });
  const serialized = JSON.stringify(execution);
  for (const prohibited of ["request_0001", "authorization_0001", "F1", "2026-09-20", "10:30", "C1"]) {
    assert.equal(serialized.includes(prohibited), false, prohibited);
  }
  assert.equal(serialized.includes("reservation_list_match_missing"), true);
});

test("selected binding integrates with the existing privacy and offline fixture-submit contracts", async () => {
  const execution = run({ facilityIds: ["F1"], requestedTimes: ["10:30"], guardianRules: [guardianRule("F1")] });
  const { binding } = selectAndLock(execution);
  const agreements = [
    { agreementId: "sms_receipt" as const, version: "v1" },
    { agreementId: "personal_data" as const, version: "v1" },
    { agreementId: "terms" as const, version: "v1" }
  ];
  const authorizationStore = new OneTimeSubmitAuthorizationStore();
  authorizationStore.authorize({ reservationButtonAuthorized: true, authorizationId: "fixture_auth", binding, agreementVersions: agreements }, now);
  const inputStore = new MemoryEphemeralReservationStore();
  inputStore.save(createEphemeralReservationInput({
    child: { name: "fixture child", birthYear: 2021, birthMonth: 5, sex: "female" },
    residence: { branch: "seoul", districtCode: "D1", neighborhoodCode: "N1" },
    guardianCount: binding.party.guardianCount,
    approvedAgreements: agreements.map((agreement) => ({ ...agreement, approvedAt: now.toISOString(), userApproved: true as const }))
  }, now), now);
  const intent = createOnDeviceReservationIntent({
    facilityId: binding.facilityId,
    facilityName: "fixture facility",
    date: binding.date,
    selectedTime: "10:30",
    selectedSlot: { id: binding.slotId, startTime: "10:00", endTime: "12:00" }
  }, now);
  const calls: string[] = [];
  await execution.dispatchOnce(() => {
    const result = executeFixtureReservationSubmit({
      capability: FIXTURE_SUBMIT_CAPABILITY,
      authorizationStore,
      inputStore,
      intent,
      observation: {
        url: `https://umppa.seoul.go.kr${KNOWN_REVIEW_FORM_PATH}`,
        screenId: KNOWN_REVIEW_SCREEN_ID,
        form: { id: KNOWN_REVIEW_FORM_ID, action: KNOWN_REVIEW_FORM_PATH, method: "POST", submitControlId: KNOWN_SUBMIT_CONTROL_ID },
        reservation: binding,
        displayedAgreements: agreements,
        validationErrors: [],
        flow: { payment: false, care: false, group: false, waitlist: false, cancellation: false }
      },
      writer: { setField: () => undefined, submit: () => { calls.push("submit"); } },
      now: later(1_000)
    });
    if (result.action !== "submit_reservation") throw new Error(result.reasonCode);
  });
  assert.deepEqual(calls, ["submit"]);
  assert.equal(execution.state, "SUBMIT_DISPATCHED");
});
