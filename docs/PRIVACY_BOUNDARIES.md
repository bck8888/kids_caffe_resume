# Reservation assistant privacy boundaries

Status: implementation contract, not legal approval
Updated: 2026-09-06

## Data classification

| Class | Examples | Allowed destination | Retention |
|---|---|---|---|
| Public facility knowledge | facility IDs, sourced rules, sessions, public addresses | facility SQLite database and public-source evidence archive | provenance policy |
| Non-identifying operational event | fixed event name, outcome, reason code | incident-safe local or server log after strict sanitization | shortest operational period; set and disclose before production |
| Local ephemeral reservation input | child name, birth year/month, sex, residence branch/codes, guardian count, user-approved agreement version/time | one in-memory reservation action only | 15 minutes maximum, explicit clear, expiry clear, or one-use consume |
| Prohibited | Seoul credentials/passwords, OTP, cookies/session/auth tokens, resident-registration identifiers, health/disability data, full DOM/HTML, screenshots | nowhere in this service | never collect |

Ephemeral reservation input must not enter facility knowledge, analytics, logs, URLs, server requests, server persistence, error reports, crash reports, or external model prompts. The current store is browser-neutral memory, not `localStorage`, `sessionStorage`, IndexedDB, a cookie, or a server session. Page refresh therefore clears it by design.

## Data-flow boundaries

- The Seoul-owned page is the official destination for Seoul login, account values, agreement controls, and final submission. This document does not characterize Seoul as this product's processor; controller/processor roles require legal review. Credentials, OTPs, cookies, and official session tokens stay on the Seoul origin.
- The reservation assistant may hold only the explicit ephemeral contract locally long enough to fill the immediate official action. A one-use `consume` clears the local copy before control continues.
- The facility-knowledge collector accepts public, unauthenticated source material only. Repository write methods reject reservation-personal and authentication-shaped keys before SQL execution.
- Analytics and logging receive only `reservation-operational-event-v1`. Unknown harmless fields are discarded; sensitive or alias-like keys anywhere in a nested payload reject the whole event.
- No external/hosted model may receive unredacted UI text, DOM/HTML, screenshots, authenticated page content, or ephemeral reservation input. A future local model must receive a minimal deterministic classification input after the same boundary review.

## Agreement handling

The assistant does not infer or manufacture official agreement approval. The fixture protocol records an agreement only when the immediate action supplies `userApproved: true`, together with the exact allowlisted agreement ID, displayed version, and approval timestamp. This is technical evidence only; whether one earlier product action can validly authorize checking each official agreement requires legal review and exact-copy verification. Missing or changed approvals stop submission; product defaults cannot convert absence into consent.

## Offline final-submit proof

Verdict: the core promise is **technically possible with a dedicated browser-neutral on-device core plus an OS-specific host that can operate the official page**, without the Seoul Kids service receiving the applicant values. It is **not production-enabled**. Connected/live final submission remains disabled until Seoul policy and legal review approve it and the exact official flow passes real-device validation.

The proof in `lib/on-device/fixture-submit-protocol.ts` runs against an offline fixture contract only. A submit attempt requires one explicit reservation-button authorization with a two-minute expiry, bound to the facility, date, slot, and party counts. The authorization and ephemeral applicant input are both consumed before the host writer receives any field or submit instruction, so a stopped or completed attempt cannot be replayed.

The action is fail-closed unless every condition is exact:

- origin is `https://umppa.seoul.go.kr`;
- the versioned review-screen identity, form identity, POST action, and submit-control identity match the known fixture contract;
- facility, date, slot, one-child scope, and guardian count match both the user intent and observed review;
- all three approved agreements (`sms_receipt`, `personal_data`, `terms`) are present with identical displayed and authorized versions;
- the official form reports no validation errors; and
- payment, care, group, waitlist, and cancellation flags are all absent.

Applicant values exist only inside `MemoryEphemeralReservationStore` and, after consumption, as direct calls to the official-page field writer. The protocol returns only fixed action/outcome/reason codes. It has no network, database, analytics, logging, URL-building, persistence, screenshot, DOM-capture, or model interface. Fixture tests verify that serializing the stores and result does not reveal the child name, birth values, or residence codes.

## Deletion and incident-safe logging

Expiry, explicit `clear`, and one-use `consume` remove the in-memory reference. Navigation, reload, tab/process termination, and crash also remove it because no durable browser or server store is used. Production incident handling must record only allowlisted event codes; stack traces, request bodies, page captures, DOM dumps, replay tools, and support-ticket attachments must not contain authenticated or ephemeral input. If leakage is suspected, stop collection, isolate access to affected logs, delete unsafe copies under the approved incident process, and complete legal/privacy notification assessment before restoring telemetry.

## Gates before connected use

- Seoul confirmation of UMPPA endpoint and any page-assistance/automation permission.
- Legal/privacy review of controller/processor roles, privacy notice, lawful basis, retention period, deletion evidence, consent wording/versioning, and incident response.
- Verification of official agreement semantics; SMS, personal-data, and terms approval must not be bundled or inferred without approval.
- Target-browser and real-device validation without capturing real personal data or screenshots.
- External-model prohibition enforcement and dependency/telemetry review for the eventual host runtime.
- Facility-specific guardian, eligibility, and evidence rules; no global value may be inferred from one facility.
- Replace fixture-only screen/form/field identities with independently validated target-device adapters, while preserving the same exact-match and consume-before-dispatch gates.
- Keep the connected capability set to `connected_submit_disabled` until the policy/legal and real-device gates above are recorded as passed.
