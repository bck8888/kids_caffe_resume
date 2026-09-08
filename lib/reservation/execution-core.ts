import type { ReservationExecutionBinding } from "../on-device/fixture-submit-protocol.ts";

export const AVAILABILITY_DEADLINE_MS = 5_000;
export const EXECUTION_AUTHORIZATION_TTL_MS = 2 * 60 * 1_000;

export const EXECUTION_REASON_CODES = [
  "none",
  "invalid_request_id",
  "invalid_authorization_id",
  "invalid_date",
  "invalid_facility",
  "too_many_facilities",
  "invalid_requested_time",
  "too_many_requested_times",
  "invalid_child_count",
  "guardian_rule_missing",
  "guardian_rule_stale",
  "guardian_rule_conflicting",
  "guardian_rule_facility_mismatch",
  "guardian_total_invalid",
  "authorization_expired",
  "availability_explicit_holiday",
  "availability_unavailable",
  "availability_ambiguous",
  "availability_expired",
  "availability_timeout",
  "availability_malformed",
  "availability_event_duplicate",
  "availability_response_late",
  "no_candidate_available",
  "execution_lock_unavailable",
  "review_binding_mismatch",
  "review_not_verified",
  "dispatch_already_attempted",
  "dispatch_ambiguous",
  "completion_evidence_missing",
  "reservation_list_match_missing",
  "reservation_list_match_conflicting",
  "verification_binding_mismatch"
] as const;

export type ExecutionReasonCode = typeof EXECUTION_REASON_CODES[number];
export type ExecutionState =
  | "AUTHORIZED"
  | "CHECKING_AVAILABILITY"
  | "CANDIDATE_SELECTED"
  | "EXECUTION_LOCKED"
  | "OFFICIAL_CALENDAR"
  | "OFFICIAL_SESSION_SELECTED"
  | "OFFICIAL_FORM"
  | "OFFICIAL_REVIEW_VERIFIED"
  | "SUBMIT_DISPATCHED"
  | "COMPLETION_CHECK"
  | "RESERVATION_LIST_CHECK"
  | "SUCCEEDED"
  | "CONFIRMATION_REQUIRED"
  | "STOPPED_PRE_SUBMIT"
  | "STOPPED_LOCKED"
  | "EXPIRED";

export type FacilityGuardianRule = {
  facilityId: string;
  status: "confirmed" | "conflicting";
  includesApplicant: true;
  maxGuardianTotal: number;
  observedAt: string;
  expiresAt: string;
};

export type ExecutionRequest = {
  requestId: string;
  authorizationId: string;
  authorizationIssuedAt: string;
  authorizationExpiresAt: string;
  date: string;
  facilityIds: string[];
  requestedTimes: string[];
  childCount: 1;
  accompanyingGuardianCount: 0 | 1;
  guardianRules: FacilityGuardianRule[];
};

export type Candidate = {
  key: string;
  facilityId: string;
  requestedTime: string;
  facilityPriority: number;
  timePriority: number;
  guardianTotal: number;
};

export type OfficialSession = {
  sessionId: string;
  startTime: string;
  endTime: string;
  useType: "individual" | string;
  remainingCapacity: number;
};

export type FacilityAvailability =
  | { kind: "available"; sessions: OfficialSession[] }
  | { kind: "explicit_holiday" }
  | { kind: "unavailable" }
  | { kind: "ambiguous" }
  | { kind: "expired" }
  | { kind: "timeout" };

const AVAILABILITY_KINDS = ["available", "explicit_holiday", "unavailable", "ambiguous", "expired", "timeout"] as const;

export type AtomicAvailabilityObservation = {
  eventId: string;
  observedAt: string;
  facilities: Array<{ facilityId: string; availability: FacilityAvailability }>;
};

export type CandidateResolution = Candidate & {
  sessionId: string;
  startTime: string;
  endTime: string;
};

export type SafeExecutionTrace = {
  sequence: number;
  state: ExecutionState;
  eventCode: string;
  reasonCode: ExecutionReasonCode;
};

type CreationFailure = { ok: false; reasonCode: ExecutionReasonCode };
type GuardianResult = { ok: true; guardianTotal: number } | CreationFailure;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const dateIsValid = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const clockMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : Number.NaN;
};

const validOpaqueId = (value: string) => /^[A-Za-z0-9_-]{1,80}$/.test(value);
const unique = (values: string[]) => [...new Set(values)];

export function deriveGuardianTotal(
  facilityId: string,
  accompanyingGuardianCount: number,
  rules: FacilityGuardianRule[],
  now = new Date()
): GuardianResult {
  if (!Array.isArray(rules)) return { ok: false, reasonCode: "guardian_rule_missing" };
  const facilityRules = rules.filter((rule) => rule.facilityId === facilityId);
  if (facilityRules.length === 0) return { ok: false, reasonCode: "guardian_rule_missing" };
  if (facilityRules.length !== 1) return { ok: false, reasonCode: "guardian_rule_conflicting" };
  const rule = facilityRules[0];
  if (!isPlainObject(rule) || rule.facilityId !== facilityId) return { ok: false, reasonCode: "guardian_rule_facility_mismatch" };
  if (rule.status !== "confirmed") return { ok: false, reasonCode: "guardian_rule_conflicting" };
  if (!Number.isFinite(Date.parse(rule.observedAt)) || !Number.isFinite(Date.parse(rule.expiresAt)) || Date.parse(rule.expiresAt) <= now.getTime()) {
    return { ok: false, reasonCode: "guardian_rule_stale" };
  }
  if (!Number.isInteger(accompanyingGuardianCount) || accompanyingGuardianCount < 0 || accompanyingGuardianCount > 1) {
    return { ok: false, reasonCode: "guardian_total_invalid" };
  }
  const guardianTotal = 1 + accompanyingGuardianCount;
  if (!rule.includesApplicant || !Number.isInteger(rule.maxGuardianTotal) || guardianTotal > rule.maxGuardianTotal) {
    return { ok: false, reasonCode: "guardian_total_invalid" };
  }
  return { ok: true, guardianTotal };
}

export function createCandidateMatrix(input: {
  facilityIds: string[];
  requestedTimes: string[];
  guardianTotals: Map<string, number>;
}): Candidate[] {
  const facilities = unique(input.facilityIds);
  const times = unique(input.requestedTimes);
  return facilities.flatMap((facilityId, facilityPriority) =>
    times.map((requestedTime, timePriority) => ({
      key: `${facilityId}::${requestedTime}`,
      facilityId,
      requestedTime,
      facilityPriority: facilityPriority + 1,
      timePriority: timePriority + 1,
      guardianTotal: input.guardianTotals.get(facilityId) as number
    }))
  );
}

function validateRequest(input: ExecutionRequest, now: Date): CreationFailure | { ok: true; candidates: Candidate[] } {
  if (!isPlainObject(input) || !validOpaqueId(input.requestId)) return { ok: false, reasonCode: "invalid_request_id" };
  if (!validOpaqueId(input.authorizationId)) return { ok: false, reasonCode: "invalid_authorization_id" };
  if (!dateIsValid(input.date)) return { ok: false, reasonCode: "invalid_date" };
  if (input.childCount !== 1) return { ok: false, reasonCode: "invalid_child_count" };
  if (!Array.isArray(input.facilityIds) || input.facilityIds.length === 0 || input.facilityIds.some((id) => !validOpaqueId(id))) {
    return { ok: false, reasonCode: "invalid_facility" };
  }
  const facilities = unique(input.facilityIds);
  if (facilities.length > 2) return { ok: false, reasonCode: "too_many_facilities" };
  if (!Array.isArray(input.requestedTimes) || input.requestedTimes.length === 0 || input.requestedTimes.some((time) => !Number.isFinite(clockMinutes(time)))) {
    return { ok: false, reasonCode: "invalid_requested_time" };
  }
  const times = unique(input.requestedTimes);
  if (times.length > 2) return { ok: false, reasonCode: "too_many_requested_times" };
  if (!Array.isArray(input.guardianRules)) return { ok: false, reasonCode: "guardian_rule_missing" };
  const issuedAt = Date.parse(input.authorizationIssuedAt);
  const expiresAt = Date.parse(input.authorizationExpiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= now.getTime() || expiresAt <= issuedAt || expiresAt - issuedAt > EXECUTION_AUTHORIZATION_TTL_MS) {
    return { ok: false, reasonCode: "authorization_expired" };
  }
  const totals = new Map<string, number>();
  for (const facilityId of facilities) {
    const result = deriveGuardianTotal(facilityId, input.accompanyingGuardianCount, input.guardianRules, now);
    if (!result.ok) return result;
    totals.set(facilityId, result.guardianTotal);
  }
  return { ok: true, candidates: createCandidateMatrix({ facilityIds: facilities, requestedTimes: times, guardianTotals: totals }) };
}

export class MemoryExecutionLock {
  #owners = new Map<string, string>();
  #ambiguous = new Set<string>();

  acquire(requestId: string, runId: string) {
    if (this.#ambiguous.has(requestId) || this.#owners.has(requestId)) return false;
    this.#owners.set(requestId, runId);
    return true;
  }

  markAmbiguous(requestId: string, runId: string) {
    if (this.#owners.get(requestId) === runId) this.#ambiguous.add(requestId);
  }

  isAmbiguous(requestId: string) { return this.#ambiguous.has(requestId); }
  toJSON() { return { classification: "single_writer_execution_lock", containsData: false }; }
}

export class ReservationExecutionRun {
  readonly candidates: readonly Candidate[];
  readonly trace: SafeExecutionTrace[] = [];
  state: ExecutionState = "AUTHORIZED";
  reasonCode: ExecutionReasonCode = "none";
  selected: CandidateResolution | undefined;
  #request: ExecutionRequest;
  #runId: string;
  #deadline: number;
  #seenEvents = new Set<string>();
  #observedFacilities = new Set<string>();
  #candidateReasons = new Map<string, ExecutionReasonCode>();
  #lock: MemoryExecutionLock | undefined;
  #authorizationConsumed = false;
  #dispatchAttempted = false;

  constructor(request: ExecutionRequest, candidates: Candidate[], now: Date) {
    this.#request = structuredClone(request);
    this.#runId = `${request.authorizationId}:${now.toISOString()}`;
    this.candidates = structuredClone(candidates);
    this.#deadline = now.getTime() + AVAILABILITY_DEADLINE_MS;
    this.record("authorized");
    this.state = "CHECKING_AVAILABILITY";
    this.record("availability_started");
  }

  private record(eventCode: string, reasonCode: ExecutionReasonCode = "none") {
    this.trace.push({ sequence: this.trace.length + 1, state: this.state, eventCode, reasonCode });
  }

  observeAtomic(observation: AtomicAvailabilityObservation, now = new Date(observation.observedAt)) {
    if (this.state !== "CHECKING_AVAILABILITY") {
      this.record("availability_ignored", "availability_response_late");
      return this.selected;
    }
    if (!isPlainObject(observation) || !validOpaqueId(observation.eventId) || !Array.isArray(observation.facilities)) {
      this.record("availability_ignored", "availability_malformed");
      return this.selected;
    }
    if (this.#seenEvents.has(observation.eventId)) {
      this.record("availability_ignored", "availability_event_duplicate");
      return this.selected;
    }
    this.#seenEvents.add(observation.eventId);
    if (!Number.isFinite(Date.parse(observation.observedAt))) {
      this.record("availability_ignored", "availability_malformed");
      return this.selected;
    }
    if (now.getTime() >= this.#deadline || Date.parse(observation.observedAt) >= this.#deadline) {
      this.record("availability_ignored", "availability_response_late");
      return this.selected;
    }
    const available: CandidateResolution[] = [];
    const facilitiesInEvent = new Set<string>();
    for (const item of observation.facilities) {
      if (!isPlainObject(item) || !validOpaqueId(item.facilityId) || !isPlainObject(item.availability) ||
          !AVAILABILITY_KINDS.includes(item.availability.kind as typeof AVAILABILITY_KINDS[number])) {
        this.record("availability_item_ignored", "availability_malformed");
        continue;
      }
      if (facilitiesInEvent.has(item.facilityId)) continue;
      facilitiesInEvent.add(item.facilityId);
      const facilityCandidates = this.candidates.filter((candidate) => candidate.facilityId === item.facilityId);
      if (facilityCandidates.length === 0 || this.#observedFacilities.has(item.facilityId)) continue;
      this.#observedFacilities.add(item.facilityId);
      if (item.availability.kind !== "available") {
        const reason = `availability_${item.availability.kind}` as ExecutionReasonCode;
        facilityCandidates.forEach((candidate) => this.#candidateReasons.set(candidate.key, reason));
        continue;
      }
      if (!Array.isArray(item.availability.sessions)) {
        facilityCandidates.forEach((candidate) => this.#candidateReasons.set(candidate.key, "availability_malformed"));
        continue;
      }
      const structurallyValidSessions = item.availability.sessions.filter((session) => {
        const start = clockMinutes(session.startTime);
        const end = clockMinutes(session.endTime);
        return validOpaqueId(session.sessionId) && Number.isFinite(start) && Number.isFinite(end) && start < end &&
          Number.isInteger(session.remainingCapacity) && session.remainingCapacity >= 0;
      });
      for (const candidate of facilityCandidates) {
        if (item.availability.sessions.length === 0) {
          this.#candidateReasons.set(candidate.key, "availability_ambiguous");
          continue;
        }
        const requested = clockMinutes(candidate.requestedTime);
        const matching = structurallyValidSessions.filter((session) => {
          const start = clockMinutes(session.startTime);
          const end = clockMinutes(session.endTime);
          return session.useType === "individual" && session.remainingCapacity > 0 &&
            start <= requested && requested < end;
        });
        if (matching.length === 1) {
          available.push({ ...candidate, sessionId: matching[0].sessionId, startTime: matching[0].startTime, endTime: matching[0].endTime });
          this.#candidateReasons.set(candidate.key, "none");
        } else {
          this.#candidateReasons.set(candidate.key,
            matching.length > 1 ? "availability_ambiguous"
              : item.availability.sessions.length > 0 && structurallyValidSessions.length === 0 ? "availability_malformed"
                : "availability_unavailable");
        }
      }
    }
    available.sort((a, b) => a.facilityPriority - b.facilityPriority || a.timePriority - b.timePriority);
    if (available[0]) {
      this.selected = available[0];
      this.state = "CANDIDATE_SELECTED";
      this.record("candidate_selected");
    } else {
      this.record("availability_observed");
    }
    return this.selected;
  }

  closeAvailability(now = new Date()) {
    if (this.state !== "CHECKING_AVAILABILITY") return;
    if (now.getTime() < this.#deadline) this.#deadline = now.getTime();
    const reasons = [...this.#candidateReasons.values()];
    this.reasonCode = reasons.includes("availability_ambiguous") ? "availability_ambiguous"
      : reasons.includes("availability_timeout") || reasons.length < this.candidates.length ? "availability_timeout"
      : reasons.every((reason) => reason === "availability_explicit_holiday") ? "availability_explicit_holiday"
      : reasons.includes("availability_expired") ? "availability_expired"
      : reasons.length > 0 ? "availability_unavailable"
      : "no_candidate_available";
    this.state = "STOPPED_PRE_SUBMIT";
    this.record("availability_closed", this.reasonCode);
  }

  acquireExecutionLock(lock: MemoryExecutionLock, now = new Date()) {
    if (this.state !== "CANDIDATE_SELECTED") return false;
    if (Date.parse(this.#request.authorizationExpiresAt) <= now.getTime()) {
      this.state = "EXPIRED";
      this.reasonCode = "authorization_expired";
      this.record("authorization_expired", this.reasonCode);
      return false;
    }
    if (!lock.acquire(this.#request.requestId, this.#runId)) {
      this.state = "STOPPED_PRE_SUBMIT";
      this.reasonCode = "execution_lock_unavailable";
      this.record("execution_lock_failed", this.reasonCode);
      return false;
    }
    this.#lock = lock;
    this.state = "EXECUTION_LOCKED";
    this.record("execution_locked");
    return true;
  }

  enterOfficialCalendar() {
    if (this.state !== "EXECUTION_LOCKED") return false;
    this.state = "OFFICIAL_CALENDAR";
    this.record("official_calendar_entered");
    return true;
  }

  markOfficialSessionSelected(binding: ReservationExecutionBinding) {
    if (this.state !== "OFFICIAL_CALENDAR") return false;
    if (!this.bindingMatches(binding)) return this.stopLockedForBindingMismatch();
    this.state = "OFFICIAL_SESSION_SELECTED";
    this.record("official_session_selected");
    return true;
  }

  enterOfficialForm() {
    if (this.state !== "OFFICIAL_SESSION_SELECTED") return false;
    this.state = "OFFICIAL_FORM";
    this.record("official_form_entered");
    return true;
  }

  selectedBinding(): ReservationExecutionBinding | undefined {
    if (!this.selected) return undefined;
    return {
      facilityId: this.selected.facilityId,
      date: this.#request.date,
      slotId: this.selected.sessionId,
      party: { childCount: 1, guardianCount: this.selected.guardianTotal }
    };
  }

  verifyOfficialReview(binding: ReservationExecutionBinding) {
    if (this.state !== "OFFICIAL_FORM") return false;
    if (!this.bindingMatches(binding)) return this.stopLockedForBindingMismatch();
    this.state = "OFFICIAL_REVIEW_VERIFIED";
    this.record("official_review_verified");
    return true;
  }

  private bindingMatches(binding: ReservationExecutionBinding) {
    const expected = this.selectedBinding();
    return !!expected && sameBinding(expected, binding);
  }

  private stopLockedForBindingMismatch() {
    this.state = "STOPPED_LOCKED";
    this.reasonCode = "review_binding_mismatch";
    this.#authorizationConsumed = true;
    this.record("review_rejected", this.reasonCode);
    return false;
  }

  async dispatchOnce(dispatcher: () => void | Promise<void>) {
    if (this.#dispatchAttempted) return { dispatched: false as const, reasonCode: "dispatch_already_attempted" as const };
    if (this.state !== "OFFICIAL_REVIEW_VERIFIED") return { dispatched: false as const, reasonCode: "review_not_verified" as const };
    this.#dispatchAttempted = true;
    this.#authorizationConsumed = true;
    this.state = "SUBMIT_DISPATCHED";
    this.record("submit_dispatched");
    try {
      await dispatcher();
      return { dispatched: true as const };
    } catch {
      this.state = "CONFIRMATION_REQUIRED";
      this.reasonCode = "dispatch_ambiguous";
      this.#lock?.markAmbiguous(this.#request.requestId, this.#runId);
      this.record("dispatch_ambiguous", this.reasonCode);
      return { dispatched: true as const, reasonCode: this.reasonCode };
    }
  }

  verifyCompletion(input: {
    officialCompletion: { binding: ReservationExecutionBinding; completionId: string } | undefined;
    reservationList: Array<{ binding: ReservationExecutionBinding; completionId: string }>;
  }) {
    if (this.state !== "SUBMIT_DISPATCHED" && this.state !== "COMPLETION_CHECK" && this.state !== "RESERVATION_LIST_CHECK") return false;
    const expected = this.selectedBinding();
    this.state = "COMPLETION_CHECK";
    this.record("completion_checked");
    if (!expected || !input.officialCompletion) return this.requireConfirmation("completion_evidence_missing");
    if (!sameBinding(expected, input.officialCompletion.binding)) return this.requireConfirmation("verification_binding_mismatch");
    this.state = "RESERVATION_LIST_CHECK";
    this.record("reservation_list_checked");
    const matches = input.reservationList.filter((record) =>
      sameBinding(expected, record.binding) && record.completionId === input.officialCompletion?.completionId
    );
    if (matches.length === 0) return this.requireConfirmation("reservation_list_match_missing");
    if (matches.length !== 1) return this.requireConfirmation("reservation_list_match_conflicting");
    this.state = "SUCCEEDED";
    this.reasonCode = "none";
    this.record("reservation_succeeded");
    return true;
  }

  private requireConfirmation(reasonCode: ExecutionReasonCode) {
    this.state = "CONFIRMATION_REQUIRED";
    this.reasonCode = reasonCode;
    this.#lock?.markAmbiguous(this.#request.requestId, this.#runId);
    this.record("confirmation_required", reasonCode);
    return false;
  }

  candidateReason(candidateKey: string) { return this.#candidateReasons.get(candidateKey); }

  toJSON() {
    return {
      classification: "non_identifying_execution_state",
      state: this.state,
      reasonCode: this.reasonCode,
      authorizationConsumed: this.#authorizationConsumed,
      dispatchAttempted: this.#dispatchAttempted,
      trace: this.trace
    };
  }
}

function sameBinding(a: ReservationExecutionBinding, b: ReservationExecutionBinding) {
  return a.facilityId === b.facilityId && a.date === b.date && a.slotId === b.slotId &&
    a.party.childCount === b.party.childCount && a.party.guardianCount === b.party.guardianCount;
}

export function createReservationExecutionRun(input: ExecutionRequest, now = new Date()): CreationFailure | { ok: true; run: ReservationExecutionRun } {
  const result = validateRequest(input, now);
  if (!result.ok) return result;
  return { ok: true, run: new ReservationExecutionRun(input, result.candidates, now) };
}
