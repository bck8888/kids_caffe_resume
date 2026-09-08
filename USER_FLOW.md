# Seoul Kids Cafe one-click reservation user flow

Updated: 2026-09-06
Status: product discovery and authenticated-field audit complete; privacy contract and offline submit protocol implemented, live host integration not started

## Product purpose

Help one parent who is caring for a child reserve one currently available Seoul Kids Cafe visit with one explicit `예약하기` action.

The product is not an opening-time competition macro. It checks only the user's four preselected candidates for one date and submits at most one reservation.

## Confirmed user flow

1. The user signs in directly on the Seoul-owned site in the dedicated browser.
2. The user chooses one date.
3. The user chooses facility priority 1 and optional facility priority 2.
4. The user chooses time priority 1 and optional time priority 2.
5. The service shows the exact reservation identity and terms covered by one `예약하기` approval.
6. On that one action, the service checks at most four candidates.
7. The first candidate observed as currently reservable is selected.
8. If multiple candidates are available in the same observation, facility priority wins, then time priority.
9. Exactly one official application is submitted. Starting one submission locks every other candidate.
10. The completion page and the Seoul reservation list are checked separately. An ambiguous outcome is `확인 필요`, never an automatic resubmission.

Candidate order used only as a simultaneous-availability tie-breaker:

1. facility 1 + time 1
2. facility 1 + time 2
3. facility 2 + time 1
4. facility 2 + time 2

## Explicit exclusions for the first version

- facility discovery, recommendation, map, or unrelated-place search;
- opening-time targeting, high-frequency refresh, or long-running reservation scheduling;
- group and program reservations;
- care-service requests, capacity checks, and care-specific fallback;
- automatic waiting-list enrollment;
- Seoul credential, OTP, cookie, or session-token storage;
- automatic retry after a final submission or an ambiguous result.

## Fixed official entry path

```text
authenticated Seoul session
  -> facility calendar: BD_selectKidsCafeResveCal.do
  -> date and session selection
  -> individual reservation type
  -> application form: BD_insertKidsCafeForm.do
  -> final confirmation
  -> official completion evidence and reservation-list verification
```

## Confirmed official calendar fields

| Meaning | Official field | Handling |
|---|---|---|
| Facility | `q_fcltyId` | user selection |
| Year/month | `q_year`, `q_month` | derived from date |
| Reservation date | `q_resveDe` | user selection |
| Day of week | `q_dayNo` | calculated with UTC-safe date logic |
| Session number | `q_tmeSn`, `q_resveTmeSn` | derived from requested time |
| Use type | `q_useSeCode` | individual only in v1 |
| Currently acceptable child count | `q_reqstPosblCo` | observed from official availability |

## Confirmed authenticated application fields

No personal values, credentials, cookies, or authenticated URLs are stored in this document.

### Account-derived or prefilled

- applicant name: displayed by the official account;
- applicant mobile number: three-part field, currently prefilled;
- representative guardian name: currently prefilled;
- representative guardian mobile number: currently prefilled.

The implementation must verify the displayed values without copying them into logs or analytics.

### User decisions required before the one-click action

| Information | Official control | Current finding |
|---|---|---|
| Residence qualification | `suYn` | Seoul resident/accompanied or Seoul-life-zone |
| Seoul district | `atdrcCode` | required for the Seoul branch |
| Administrative neighborhood | `insttCode` | required for the Seoul branch |
| Non-Seoul province/city | `brtcCode` | conditional branch |
| Non-Seoul local authority | `q_bsisSfrnd` | conditional branch |
| Accompanying guardian count | `acmpnyPrtctorCo` | validated against facility/child rules |
| Child name | `chilList[n].chilNm` | one row per child |
| Child sex | `chilList[n].sexdstnCode` | official form requires a selection |
| Child birth year | `chilList[n].birthYear` | official form requires a selection |
| Child birth month | `chilList[n].birthMm` | official form requires a selection |
| SMS receipt agreement | `smsRecptnAgreAt` | official validation currently requires agreement |
| Personal-data agreement | `agree_chk_1` | official validation currently requires agreement |
| Terms/rules agreement | `agree_chk_2` | official validation currently requires agreement |

### Product-set defaults

The service may set a field automatically when the current official facility rule proves that the value is allowed and the value does not add cost, consume a scarce reservation unit, change eligibility, or create an obligation for the user.

- Care service is always off and is not offered in the first version.
- Reservation type is individual.
- Waiting-list enrollment is off.
- For one child, the intended default is two guardians in total when the facility permits it.
- The inspected Bangbae 2-dong facility (`SC240404`) labels `acmpnyPrtctorCo` as `동반 보호자 수(신청인 포함)` and states that up to two guardians are allowed. Therefore `1` means the applicant/representative guardian visits alone, and `2` means applicant/representative guardian 1 + accompanying guardian 1. For this confirmed facility case, the product-set maximum is `2`.
- A user may arrive with fewer guardians than the allowed default only where the official facility rule and current product validation confirm that this has no fee, capacity, or attendance consequence.
- Never apply a global maximum to a facility-specific field without a current verified rule. A missing rule produces `확인 필요`, not an inferred maximum.

### Conditional fields retained for roadmap completeness

- child-row add/remove behavior and maximum child count;
- care-service availability, capacity, cost, and eligibility as facility knowledge only; no reservation action;
- waiting-list capacity and opt-in confirmation;
- group organization location, name, contact, and participant fields;
- facility-specific evidence requirements and attendance rules;
- duplicate reservation, monthly limit, no-show restriction, age eligibility, and capacity validation.

Conditional fields are recorded for future decisions but are not enabled in the first-version user flow.

## Observed interruptions and branches

### Normal-path interruptions

1. A shared no-show penalty notice popup appears on the facility calendar unless its seven-day cookie is present.
2. After date/session selection, a native alert states the currently reservable child capacity.
3. NetFunnel may show a traffic waiting state before the application form.
4. Final submission raises a confirmation asking whether to register the reservation with the current information.

### Conditional or failure branches

- expired login session;
- invalid or omitted date, session, use type, contact, residence, guardian, child, or agreement values;
- facility holiday, temporary closure, special program, or external reservation link;
- sold-out normal capacity with or without waiting capacity;
- duplicate reservation for the same date/session;
- monthly usage limit;
- no-show restriction;
- child-count, guardian-count, age, or care-capacity violation;
- official response or network state that does not prove success.

Known popups are handled only when the observed stable identity and expected semantics both match. Unknown overlays stop the flow for review.

## Facility knowledge and ontology scope

Ontology does not require a vector database. The first implementation uses SQLite as the authoritative local store because the core questions are exact, relational, versioned, and provenance-sensitive.

### Observable objects

- Facility, Address, District, ContactChannel
- ReservationCalendar, Session, AvailabilityObservation
- ClosureEvent, ClosureReason
- EligibilityRule, CapacityRule, GuardianRule, EvidenceRequirement
- PlayZone, Equipment, EquipmentAlias, EquipmentAttribute
- Program, CareService, FeeRule, AttendanceRule
- Source, SourceSnapshot, Assertion, VerificationState

### Important links

- facility `HAS_SESSION` session;
- facility `HAS_PLAY_ZONE` play zone;
- play zone `CONTAINS_EQUIPMENT` equipment;
- facility `HAS_RULE` versioned rule;
- facility `HAS_CLOSURE` closure event;
- assertion `SUPPORTED_BY` source snapshot;
- normalized equipment `HAS_ALIAS` source term;
- availability observation `OBSERVED_FOR` facility/session/date.

### Evidence and time requirements

Every changeable facility assertion records:

- source URL/source type and source authority;
- raw source snapshot or content hash;
- observed/known/recorded time;
- effective start/end time when supplied;
- verification state: confirmed, inferred, conflicting, or not observed;
- normalizer/parser version and supersession lineage.

Absence from a source means `not_observed`, not `confirmed_absent`.

## Storage recommendation

### SQLite: authoritative operational store

- facilities, aliases, addresses and contacts;
- facility rules and eligibility conditions;
- play zones, equipment, attributes and facility-equipment links;
- closures, programs, care services and session definitions;
- sources, raw snapshots, parsing results, conflicts and revisions;
- short-lived availability observations and non-personal execution audit.

### Files: raw evidence archive

Keep timestamped raw JSON/HTML/image metadata outside SQLite when convenient; SQLite stores its content hash, location, provenance, and parsing status. Never archive authenticated pages containing personal data.

### Vector index: optional later projection

Add a vector index only if a later roadmap branch needs semantic equipment search, fuzzy facility-description matching, or recommendations. It is a derived, rebuildable index over approved non-personal text, never the source of truth. SQLite identifiers and provenance remain authoritative.

A graph database is also deferred. Introduce one only after graph traversal questions cannot be answered clearly or efficiently with SQLite relations.

## Roadmap information to collect now

For all facilities, collect when available:

- stable facility identifiers, names and aliases;
- address, district, coordinates, contact and official URLs;
- facility type, operator, opening hours, fees and payment method;
- supported ages, residency/life-zone conditions and required evidence;
- child, guardian, group, frequency, duplicate and no-show rules;
- normal sessions, program sessions, care availability and waiting-list rules;
- holidays, temporary closures, weather closures and source-stated reasons;
- play zones, equipment, source wording, aliases, attributes and target ages;
- accessibility, parking, transit, food, socks, preparation and safety notices;
- official images/documents as source references and extraction status;
- source snapshot, retrieval time, parser version, confidence, conflict and supersession.

Do not expose equipment recommendations in the current user flow. Collection now preserves a future, source-grounded branch without widening the reservation MVP.

## Open product decisions

The user will decide how the confirmed application information is entered and retained, including:

- whether account-prefilled contact/guardian data is accepted as-is or reviewed;
- whether residence and administrative area become a reusable local profile;
- how many children can be preconfigured and how a child is selected;
- whether child sex and birth year/month are stored locally or entered per session;
- default guardian behavior for facilities whose official rule differs from the verified `total 2` case;
- how the three required agreements are presented in the single approval;
- whether SMS agreement is treated as operationally required or separately explained;
- retention/deletion rules for direct personal data.

## Verification status

- Live authenticated browser inspection reached the application form on 2026-09-06.
- No reservation was submitted.
- Calendar fields, authenticated form controls, validation branches, and the final confirmation call were inspected.
- Completion page, reservation-list matching, facility variants, care flow, waiting flow, NetFunnel under load, and policy permission remain unverified.
