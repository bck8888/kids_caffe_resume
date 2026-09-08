import type { OnDeviceReservationIntent } from "./assistant-protocol.ts";
import type {
  ApprovedAgreement,
  EphemeralReservationInput,
  MemoryEphemeralReservationStore
} from "../privacy/reservation-privacy.ts";
import { AGREEMENT_IDS } from "../privacy/reservation-privacy.ts";
import { validateOnDeviceReservationIntent } from "./assistant-protocol.ts";

export const FIXTURE_SUBMIT_CAPABILITY = "offline_fixture_submit_v1" as const;
export const SUBMIT_AUTHORIZATION_TTL_MS = 2 * 60 * 1000;
export const OFFICIAL_UMPPA_ORIGIN = "https://umppa.seoul.go.kr";
export const KNOWN_REVIEW_SCREEN_ID = "umppa_kids_cafe_review_fixture_v1";
export const KNOWN_REVIEW_FORM_ID = "kidsCafeReservationReviewForm";
export const KNOWN_REVIEW_FORM_PATH = "/icare/user/kidsCafeResve/BD_insertKidsCafeForm.do";
export const KNOWN_SUBMIT_CONTROL_ID = "submitReservation";

type AgreementVersion = Pick<ApprovedAgreement, "agreementId" | "version">;

export type ReservationExecutionBinding = {
  facilityId: string;
  date: string;
  slotId: string;
  party: { childCount: 1; guardianCount: number };
};

type SubmitAuthorization = {
  schemaVersion: "reservation-submit-authorization-v1";
  authorizationId: string;
  issuedAt: string;
  expiresAt: string;
  binding: ReservationExecutionBinding;
  agreementVersions: AgreementVersion[];
};

export type FixtureReviewObservation = {
  url: string;
  screenId: typeof KNOWN_REVIEW_SCREEN_ID | string;
  form: {
    id: typeof KNOWN_REVIEW_FORM_ID | string;
    action: string;
    method: string;
    submitControlId: typeof KNOWN_SUBMIT_CONTROL_ID | string;
  };
  reservation: ReservationExecutionBinding;
  displayedAgreements: AgreementVersion[];
  validationErrors: string[];
  flow: {
    payment: boolean;
    care: boolean;
    group: boolean;
    waitlist: boolean;
    cancellation: boolean;
  };
};

export type DirectOfficialPageWriter = {
  setField(fieldId: string, value: string): void;
  submit(formId: typeof KNOWN_REVIEW_FORM_ID, controlId: typeof KNOWN_SUBMIT_CONTROL_ID): void;
};

export type FixtureSubmitResult =
  | { action: "submit_reservation"; outcome: "fixture_dispatched"; authorizationConsumed: true }
  | { action: "stop"; outcome: "stopped"; reasonCode: string; authorizationConsumed: boolean };

const cloneBinding = (binding: ReservationExecutionBinding): ReservationExecutionBinding => ({
  facilityId: binding.facilityId,
  date: binding.date,
  slotId: binding.slotId,
  party: { ...binding.party }
});

const sameBinding = (a: ReservationExecutionBinding, b: ReservationExecutionBinding) =>
  a.facilityId === b.facilityId && a.date === b.date && a.slotId === b.slotId &&
  a.party.childCount === b.party.childCount && a.party.guardianCount === b.party.guardianCount;

const normalizedVersions = (agreements: AgreementVersion[]) =>
  agreements.map(({ agreementId, version }) => `${agreementId}:${version}`).sort();

const sameVersions = (a: AgreementVersion[], b: AgreementVersion[]) => {
  const left = normalizedVersions(a);
  const right = normalizedVersions(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

const hasEveryRequiredAgreement = (agreements: AgreementVersion[]) => {
  const ids = agreements.map(({ agreementId }) => agreementId);
  return ids.length === AGREEMENT_IDS.length && new Set(ids).size === AGREEMENT_IDS.length &&
    AGREEMENT_IDS.every((agreementId) => ids.includes(agreementId));
};

export class OneTimeSubmitAuthorizationStore {
  #value: SubmitAuthorization | undefined;

  authorize(value: {
    reservationButtonAuthorized: true;
    authorizationId: string;
    binding: ReservationExecutionBinding;
    agreementVersions: AgreementVersion[];
  }, now = new Date()) {
    if (value.reservationButtonAuthorized !== true) throw new TypeError("Explicit reservation-button authorization is required.");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(value.authorizationId)) throw new TypeError("Authorization id is invalid.");
    if (!value.binding.facilityId || !value.binding.date || !value.binding.slotId || value.binding.party.childCount !== 1 || !Number.isInteger(value.binding.party.guardianCount)) {
      throw new TypeError("Reservation execution binding is invalid.");
    }
    if (!hasEveryRequiredAgreement(value.agreementVersions) || value.agreementVersions.some(({ version }) => !/^[A-Za-z0-9._-]{1,64}$/.test(version))) {
      throw new TypeError("Every required agreement and exact version is required.");
    }
    this.#value = {
      schemaVersion: "reservation-submit-authorization-v1",
      authorizationId: value.authorizationId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SUBMIT_AUTHORIZATION_TTL_MS).toISOString(),
      binding: cloneBinding(value.binding),
      agreementVersions: value.agreementVersions.map((agreement) => ({ ...agreement }))
    };
  }

  consume(now = new Date()): SubmitAuthorization | undefined {
    const value = this.#value;
    this.#value = undefined;
    if (!value || Date.parse(value.expiresAt) <= now.getTime()) return undefined;
    return structuredClone(value);
  }

  clear() { this.#value = undefined; }

  toJSON() { return { classification: "one_time_submit_authorization", containsData: false }; }
}

function stop(reasonCode: string, authorizationConsumed: boolean): FixtureSubmitResult {
  return { action: "stop", outcome: "stopped", reasonCode, authorizationConsumed };
}

function intentBinding(intent: OnDeviceReservationIntent, input: EphemeralReservationInput): ReservationExecutionBinding {
  return {
    facilityId: intent.reservation.facilityId,
    date: intent.reservation.date,
    slotId: intent.reservation.selectedSlot.id,
    party: { childCount: 1, guardianCount: input.guardianCount }
  };
}

function writeDirectOfficialFields(writer: DirectOfficialPageWriter, input: EphemeralReservationInput) {
  writer.setField("childName", input.child.name);
  writer.setField("childBirthYear", String(input.child.birthYear));
  writer.setField("childBirthMonth", String(input.child.birthMonth).padStart(2, "0"));
  writer.setField("childSex", input.child.sex);
  writer.setField("residenceBranch", input.residence.branch);
  if (input.residence.branch === "seoul") {
    writer.setField("districtCode", input.residence.districtCode);
    writer.setField("neighborhoodCode", input.residence.neighborhoodCode);
  } else {
    writer.setField("provinceCode", input.residence.provinceCode);
    writer.setField("localAuthorityCode", input.residence.localAuthorityCode);
  }
  writer.setField("guardianCount", String(input.guardianCount));
}

export function executeFixtureReservationSubmit(args: {
  capability: typeof FIXTURE_SUBMIT_CAPABILITY | "connected_submit_disabled";
  authorizationStore: OneTimeSubmitAuthorizationStore;
  inputStore: MemoryEphemeralReservationStore;
  intent: OnDeviceReservationIntent;
  observation: FixtureReviewObservation;
  writer: DirectOfficialPageWriter;
  now?: Date;
}): FixtureSubmitResult {
  const now = args.now ?? new Date();
  const authorization = args.authorizationStore.consume(now);
  if (!authorization) return stop("authorization_missing_or_expired", false);

  // Consume personal values before any page write or submit dispatch. Every failure also burns the attempt.
  const input = args.inputStore.consume(now);
  if (!input) return stop("ephemeral_input_missing_or_expired", true);
  if (args.capability !== FIXTURE_SUBMIT_CAPABILITY) return stop("connected_submit_disabled", true);
  if (!validateOnDeviceReservationIntent(args.intent, now)) return stop("intent_invalid_or_expired", true);

  let url: URL;
  let formAction: URL;
  try {
    url = new URL(args.observation.url);
    formAction = new URL(args.observation.form.action, url);
  } catch {
    return stop("invalid_official_url", true);
  }
  if (url.origin !== OFFICIAL_UMPPA_ORIGIN || formAction.origin !== OFFICIAL_UMPPA_ORIGIN) return stop("unsafe_origin", true);
  if (url.pathname !== KNOWN_REVIEW_FORM_PATH || formAction.pathname !== KNOWN_REVIEW_FORM_PATH) return stop("unknown_review_path", true);
  if (args.observation.screenId !== KNOWN_REVIEW_SCREEN_ID || args.observation.form.id !== KNOWN_REVIEW_FORM_ID ||
      args.observation.form.method.toUpperCase() !== "POST" || args.observation.form.submitControlId !== KNOWN_SUBMIT_CONTROL_ID) {
    return stop("unknown_review_form", true);
  }
  if (args.observation.validationErrors.length !== 0) return stop("pending_validation_errors", true);
  if (Object.values(args.observation.flow).some(Boolean)) return stop("excluded_flow", true);

  const binding = intentBinding(args.intent, input);
  if (!sameBinding(binding, authorization.binding) || !sameBinding(binding, args.observation.reservation)) return stop("intent_mismatch", true);
  const approvals = input.approvedAgreements.map(({ agreementId, version }) => ({ agreementId, version }));
  if (!hasEveryRequiredAgreement(approvals) || !hasEveryRequiredAgreement(args.observation.displayedAgreements) ||
      !sameVersions(approvals, authorization.agreementVersions) || !sameVersions(approvals, args.observation.displayedAgreements)) {
    return stop("agreement_missing_or_version_mismatch", true);
  }

  writeDirectOfficialFields(args.writer, input);
  args.writer.submit(KNOWN_REVIEW_FORM_ID, KNOWN_SUBMIT_CONTROL_ID);
  return { action: "submit_reservation", outcome: "fixture_dispatched", authorizationConsumed: true };
}
