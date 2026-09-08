import { assertNoSensitiveKeys } from "./key-policy.mjs";

export const RESERVATION_DATA_CLASSIFICATION = {
  publicFacilityKnowledge: "public_facility_knowledge",
  operationalEvent: "non_identifying_operational_event",
  ephemeralReservationInput: "local_ephemeral_reservation_input",
  prohibited: "prohibited"
} as const;

export const EPHEMERAL_RESERVATION_TTL_MS = 15 * 60 * 1000;

export const AGREEMENT_IDS = ["sms_receipt", "personal_data", "terms"] as const;
export type AgreementId = typeof AGREEMENT_IDS[number];

export type ApprovedAgreement = {
  agreementId: AgreementId;
  version: string;
  approvedAt: string;
  userApproved: true;
};

export type EphemeralReservationInput = {
  schemaVersion: "ephemeral-reservation-input-v1";
  classification: "local_ephemeral_reservation_input";
  createdAt: string;
  expiresAt: string;
  child: {
    name: string;
    birthYear: number;
    birthMonth: number;
    sex: "female" | "male";
  };
  residence:
    | { branch: "seoul"; districtCode: string; neighborhoodCode: string }
    | { branch: "non_seoul"; provinceCode: string; localAuthorityCode: string };
  guardianCount: number;
  approvedAgreements: ApprovedAgreement[];
};

type ReservationInput = Pick<EphemeralReservationInput, "child" | "residence" | "guardianCount"> & {
  approvedAgreements: ApprovedAgreement[];
};

const plainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function requireExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected) throw new TypeError(`${label} contains an unsupported key: ${unexpected}`);
  const missing = allowed.find((key) => !(key in value));
  if (missing) throw new TypeError(`${label} is missing a required key: ${missing}`);
}

function validCode(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

function validateApprovedAgreement(value: unknown): asserts value is ApprovedAgreement {
  if (!plainObject(value)) throw new TypeError("Agreement approval must be an object.");
  requireExactKeys(value, ["agreementId", "version", "approvedAt", "userApproved"], "Agreement approval");
  if (!AGREEMENT_IDS.includes(value.agreementId as AgreementId)) throw new TypeError("Unknown agreement id.");
  if (value.userApproved !== true) throw new TypeError("Agreements require an explicit user approval.");
  if (typeof value.version !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(value.version)) throw new TypeError("Agreement version is invalid.");
  if (typeof value.approvedAt !== "string" || !Number.isFinite(Date.parse(value.approvedAt))) throw new TypeError("Agreement approval time is invalid.");
}

export function createEphemeralReservationInput(
  value: ReservationInput,
  now = new Date()
): EphemeralReservationInput {
  assertNoSensitiveKeys(value, { allowReservationPersonal: true });
  if (!plainObject(value)) throw new TypeError("Reservation input must be an object.");
  requireExactKeys(value, ["child", "residence", "guardianCount", "approvedAgreements"], "Reservation input");
  if (!plainObject(value.child)) throw new TypeError("Child input must be an object.");
  requireExactKeys(value.child, ["name", "birthYear", "birthMonth", "sex"], "Child input");
  if (typeof value.child.name !== "string" || !value.child.name.trim() || value.child.name.length > 80) throw new TypeError("Child name is invalid.");
  if (!Number.isInteger(value.child.birthYear) || value.child.birthYear < 2000 || value.child.birthYear > now.getUTCFullYear()) throw new TypeError("Child birth year is invalid.");
  if (!Number.isInteger(value.child.birthMonth) || value.child.birthMonth < 1 || value.child.birthMonth > 12) throw new TypeError("Child birth month is invalid.");
  if (value.child.sex !== "female" && value.child.sex !== "male") throw new TypeError("Child sex is invalid.");
  if (!plainObject(value.residence)) throw new TypeError("Residence input must be an object.");
  if (value.residence.branch === "seoul") {
    requireExactKeys(value.residence, ["branch", "districtCode", "neighborhoodCode"], "Seoul residence");
    if (!validCode(value.residence.districtCode) || !validCode(value.residence.neighborhoodCode)) throw new TypeError("Seoul residence codes are invalid.");
  } else if (value.residence.branch === "non_seoul") {
    requireExactKeys(value.residence, ["branch", "provinceCode", "localAuthorityCode"], "Non-Seoul residence");
    if (!validCode(value.residence.provinceCode) || !validCode(value.residence.localAuthorityCode)) throw new TypeError("Non-Seoul residence codes are invalid.");
  } else {
    throw new TypeError("Residence branch is invalid.");
  }
  if (!Number.isInteger(value.guardianCount) || value.guardianCount < 1 || value.guardianCount > 10) throw new TypeError("Guardian count is invalid.");
  if (!Array.isArray(value.approvedAgreements)) throw new TypeError("Agreement approvals must be an array.");
  value.approvedAgreements.forEach(validateApprovedAgreement);
  if (new Set(value.approvedAgreements.map((item) => item.agreementId)).size !== value.approvedAgreements.length) throw new TypeError("Agreement approval is duplicated.");

  return {
    schemaVersion: "ephemeral-reservation-input-v1",
    classification: "local_ephemeral_reservation_input",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EPHEMERAL_RESERVATION_TTL_MS).toISOString(),
    child: { ...value.child, name: value.child.name.trim() },
    residence: { ...value.residence },
    guardianCount: value.guardianCount,
    approvedAgreements: value.approvedAgreements.map((agreement) => ({ ...agreement }))
  };
}

export function isUsableEphemeralReservationInput(value: unknown, now = new Date()): value is EphemeralReservationInput {
  if (!plainObject(value) || value.schemaVersion !== "ephemeral-reservation-input-v1" || value.classification !== "local_ephemeral_reservation_input") return false;
  const expiresAt = Date.parse(String(value.expiresAt ?? ""));
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export class MemoryEphemeralReservationStore {
  #value: EphemeralReservationInput | undefined;

  save(value: EphemeralReservationInput, now = new Date()) {
    if (!isUsableEphemeralReservationInput(value, now)) throw new TypeError("Ephemeral reservation input is invalid or expired.");
    this.#value = structuredClone(value);
  }

  load(now = new Date()): EphemeralReservationInput | undefined {
    if (!this.#value) return undefined;
    if (!isUsableEphemeralReservationInput(this.#value, now)) {
      this.clear();
      return undefined;
    }
    return structuredClone(this.#value);
  }

  consume(now = new Date()): EphemeralReservationInput | undefined {
    const value = this.load(now);
    this.clear();
    return value;
  }

  clear() {
    this.#value = undefined;
  }

  toJSON() {
    return { classification: "local_ephemeral_store", containsData: false };
  }
}

const EVENT_NAMES = [
  "reservation_intent_created", "reservation_intent_expired", "reservation_intent_cleared",
  "official_handoff_opened", "assistant_stopped"
] as const;
const EVENT_OUTCOMES = ["ok", "rejected", "expired", "cleared", "stopped"] as const;
const REASON_CODES = ["none", "invalid_input", "expired", "user_cleared", "unsafe_origin", "unknown_screen", "policy_stop"] as const;

export type OperationalEvent = {
  schemaVersion: "reservation-operational-event-v1";
  name: typeof EVENT_NAMES[number];
  outcome: typeof EVENT_OUTCOMES[number];
  reasonCode: typeof REASON_CODES[number];
};

export function sanitizeOperationalEvent(value: unknown): OperationalEvent {
  assertNoSensitiveKeys(value);
  if (!plainObject(value)) throw new TypeError("Operational event must be an object.");
  if (!EVENT_NAMES.includes(value.name as OperationalEvent["name"])) throw new TypeError("Operational event name is not allowlisted.");
  if (!EVENT_OUTCOMES.includes(value.outcome as OperationalEvent["outcome"])) throw new TypeError("Operational event outcome is not allowlisted.");
  const reasonCode = value.reasonCode ?? "none";
  if (!REASON_CODES.includes(reasonCode as OperationalEvent["reasonCode"])) throw new TypeError("Operational event reason is not allowlisted.");
  return {
    schemaVersion: "reservation-operational-event-v1",
    name: value.name as OperationalEvent["name"],
    outcome: value.outcome as OperationalEvent["outcome"],
    reasonCode: reasonCode as OperationalEvent["reasonCode"]
  };
}
