# Seoul Kids Cafe one-button reservation: final product and system design

Updated: 2026-09-06
Status: final design for review; connected submission is disabled
Scope: one parent, one child, one date, one or two prioritized facilities, one or two prioritized times, one explicit reservation action, and at most one official individual reservation

## 1. Product decision

The MVP is a narrow reservation executor, not a facility-discovery product or an opening-time macro.

A parent first signs in directly on the Seoul-owned site inside a dedicated Docker browser and prepares all required reservation information. The product then shows the exact facility/date/time/party/agreements covered by one `예약하기` action. That single action authorizes one bounded run which:

1. checks no more than four preselected candidates for the chosen date;
2. selects the first currently reservable candidate, using facility priority and then time priority to break availability observed in the same check epoch;
3. locks every other candidate before the official application flow begins;
4. fills and submits exactly one known official individual-reservation form; and
5. verifies both an official completion indication and the matching Seoul reservation-list entry.

If success is not proved, the result is `확인 필요`. The system never automatically submits a second candidate after a submission attempt or an ambiguous result.

### Candidate order

For candidates observed as available in the same check epoch, the deterministic order is:

1. facility priority 1 + time priority 1;
2. facility priority 1 + time priority 2;
3. facility priority 2 + time priority 1;
4. facility priority 2 + time priority 2.

Missing optional choices are omitted and duplicate facility/session candidates are collapsed. Location priority therefore wins simultaneous ties. This ordering is not a polling schedule: the run performs one bounded availability check and does not wait for a future opening.

## 2. Authority and reconciliation

This document is the single product/system design for the current one-button goal. The following precedence resolves earlier contradictions:

1. the direct 2026-09-06 user decision and `USER_FLOW.md`;
2. the updated `SEOUL_FLOW_FEASIBILITY.md` and privacy contract;
3. current repository behavior and facility-knowledge evidence;
4. older handoffs, test plans, and UI descriptions as historical context only.

| Earlier statement | Current resolution |
|---|---|
| Final submission must always be a separate user click on Seoul | Superseded for this target. One fresh `예약하기` press may authorize exactly one bound final submit, but connected use remains disabled until policy, legal, adapter, and real-device gates pass. |
| The flow starts with Kakao login | Superseded for this MVP. The user signs in directly on the Seoul-owned site in the dedicated browser; the assistant never receives credentials, OTPs, cookies, or tokens. |
| Select one facility, then show the containing and next slot | Superseded for the execution flow by up to two prioritized facilities and two prioritized requested times. Each time is resolved to an official session for each facility at execution time. |
| Main UI includes favorites, recommendations, and discovery | Out of this release's reservation path. Existing discovery/preparation UI may remain a clearly separate fallback, but it is not part of the one-button executor. |
| Edge AI is the product | Rejected. The product is deterministic reservation execution. Local AI is an optional recovery helper only. |

The AGENTS.md restriction on automatic submission requires an explicit request after legal/policy review. This document satisfies the explicit design request only; it does not satisfy the legal/policy review and does not authorize implementation or connected submission.

## 3. What is verified, decided, assumed, and gated

### Verified facts in the current checkout

- The official path observed in current research is facility calendar `BD_selectKidsCafeResveCal.do`, then date/session and individual type, then application form `BD_insertKidsCafeForm.do`, final confirmation, completion evidence, and reservation-list verification.
- The calendar uses `q_fcltyId`, `q_year`, `q_month`, `q_resveDe`, `q_dayNo`, `q_tmeSn`/`q_resveTmeSn`, `q_useSeCode`, and observed `q_reqstPosblCo`.
- Authenticated inspection on 2026-09-06 reached the application form without submitting. Applicant/guardian contact fields were observed as account-prefilled; residence, guardian, child, SMS, personal-data, and terms controls were observed as required or conditional inputs.
- Known interruptions include a no-show notice, a capacity alert, possible NetFunnel waiting, and a final confirmation. Completion-page behavior, reservation-list matching, load-time NetFunnel behavior, and facility variants are not verified.
- The ordinary web/PWA cannot inspect or operate the cross-origin official page. A dedicated, policy-approved host runtime is required.
- The repository has an offline fixture protocol with exact origin/form/control matching, two-minute one-time submit authorization, 15-minute in-memory personal input, consume-before-dispatch behavior, exclusion checks, and no live navigation or submission.
- The facility-knowledge SQLite database contains public data for 137 facilities. The reported local database is about 95 MB after two retrieval passes, with 26,179 assertion versions and 7,920 availability-observation versions.
- Facility knowledge treats missing data as `not_observed`; unavailable or empty results without a source-stated reason remain ambiguous. Availability observations expire after six hours.
- The public UMPPA slot/page integration is still a production-policy risk.

### Design decisions

- Run one ephemeral Docker browser session per active user action; do not mount its browser profile as durable storage.
- Check at most two facilities once, concurrently where safe, and resolve at most two requested times per facility from the same facility observation.
- Treat each completed facility-response batch as one atomic observation. The first atomic observation containing a reservable candidate wins; facility priority and then time priority break ties only among candidates in that same observation. Close with no winner when all responses finish or the check deadline expires.
- Acquire a one-time execution lock before navigating or writing the selected official application. After lock acquisition there is no automatic fallback to another candidate.
- Use deterministic adapters for all normal-path observation and actions. Unknown identity, changed terms, changed validation, or uncertain success stops.
- Keep public facility knowledge and provenance in SQLite. Keep personal reservation data, official session state, and execution authorization out of SQLite.
- Do not use Gamma. Treat any future purpose-fit tiny local notice classifier as optional, non-sensitive, and removable—not as an autonomous agent or source of truth.

### Assumptions requiring validation

- A policy-approved Chromium-based browser can be operated inside the Docker boundary while the Seoul login/session cookie remains usable only by that browser.
- Required Seoul and identity-provider domains can be completely enumerated for an egress allowlist.
- Each requested wall-clock time can be deterministically mapped to one official individual session for each facility using current official data.
- One earlier product approval can lawfully and accurately authorize the exact displayed versions of the three official agreements and the final confirmation.
- The reservation list exposes enough non-sensitive fields to match the attempted facility/date/session without retaining personal page content.
- A safe, non-sensitive structural representation can distinguish supported disruptions without sending page text, DOM, or screenshots to a model.

### Current implementation gap

- The current customer UI and `/api/reservations` handle one facility/date request at a time; there is no two-facility/two-time observation epoch, single-writer lock, or reservation-list verifier.
- The current general host planner remains rules-only and highlights the final submit control instead of dispatching it. `submit_reservation` exists in the action type allowlist but is absent from the default connected intent actions.
- Only the separate offline fixture protocol can dispatch its exact fixture submit control. It has no live authenticated navigation or production adapter.
- The package has no dedicated Docker browser host, tiny-classifier runtime, resource instrumentation, or connected-submit dependency.
- The current reservation route's weekday calculation is not the UTC-safe construction required by this design and must pass a container-timezone regression test before connected use.
- No current source implements the final design in this document; these gaps are release blockers, not implied follow-up authorization.

### Release gates

No connected submit capability may be enabled until every gate in section 13 passes. Until then the runtime capability must remain `connected_submit_disabled`, and customer copy must describe only reservation preparation or an offline demo.

## 4. User contract and inputs

All decisions below are completed before the one `예약하기` action. The final review shows human-readable values, their priority, the one-reservation limit, the expiry of the approval, and the no-retry-on-ambiguity rule.

### Explicit user inputs

| Input | Cardinality/validation | Purpose |
|---|---|---|
| Authenticated Seoul session | One, created by the user directly on Seoul | Lets the official page prefill account-owned fields; never copied by the assistant |
| Reservation date | Exactly one valid local calendar date | Shared by all candidates |
| Facility priority 1 | Exactly one stable official facility ID | Highest location priority |
| Facility priority 2 | Optional; distinct stable official facility ID | Fallback location in the same bounded check |
| Time priority 1 | Exactly one valid `HH:MM` wall-clock time | Highest time preference within a facility |
| Time priority 2 | Optional; distinct `HH:MM` wall-clock time | Second time preference within a facility |
| Residence qualification | Seoul or non-Seoul/life-zone branch | Selects the official conditional area controls |
| Administrative area | District + neighborhood for Seoul, or province/city + local authority for non-Seoul | Supplies the chosen residence branch |
| Guardian count | Integer allowed by the selected facility rule | Party binding |
| Child | Exactly one: name, official sex option, birth year, birth month | First-version individual reservation party |
| SMS receipt approval | Explicit approval to the exact displayed version | Required official agreement observed in current audit |
| Personal-data approval | Explicit approval to the exact displayed version | Required official agreement |
| Terms/rules approval | Explicit approval to the exact displayed version | Required official agreement |
| One-button authorization | Fresh explicit press after reviewing all above | Authorizes one bounded check and at most one bound official submit |

Applicant name/mobile and representative guardian name/mobile are verified visually as official account-prefilled values. The assistant does not copy, persist, compare in telemetry, or show them outside the official page. If the user has not decided whether those prefilled values are acceptable, the one-button action stays disabled.

### Derived fields

| Derived value | Rule |
|---|---|
| `q_year`, `q_month` | Parse from the validated date, preserving the Asia/Seoul calendar date |
| `q_resveDe` | Exact user date |
| `q_dayNo` | UTC-safe date construction and UTC weekday access; no environment-local parsing |
| Candidate set | Cartesian product of supplied facilities and times, maximum four, with duplicates removed |
| Official session IDs | Resolve requested time to the facility's current official individual session; bind `q_tmeSn` and `q_resveTmeSn` only after exact match |
| `q_reqstPosblCo` | Read from the current official availability state; never guessed or carried from an expired observation |
| Candidate rank | Facility priority first, then time priority |
| Execution binding | Facility ID + date + session ID + child count 1 + guardian count + exact agreement versions |
| Authorization expiry | Two minutes from the final button press; one use only |
| Personal-input expiry | Fifteen minutes maximum and also cleared on consume, cancel, reload, navigation loss, process exit, or crash |

### Product defaults

- reservation/use type: individual;
- child count: one;
- care service: off and unavailable in this release;
- waiting list: off;
- group/program/cancellation/payment: excluded;
- automatic retry after lock, submit dispatch, or ambiguous result: off;
- guardian count: no global default. A facility-specific default may be offered only from a current confirmed rule and must remain visible/editable before authorization;
- current Bangbae 2-dong evidence permits total guardian count 2 for its inspected one-child case, but this value must not be generalized.

If any required value cannot be safely derived or defaulted, the button remains disabled and the UI identifies the missing decision. Absence is never silently converted into a default.

## 5. Availability and tie-breaking algorithm

1. Validate the date, 1-2 distinct facilities, 1-2 distinct times, party data, and exact agreement versions.
2. Create the deduplicated candidate matrix in deterministic priority order.
3. Start one observation epoch. Fetch each selected facility's current official/read-only availability once, with no more than two concurrent requests and no retry loop.
4. Reject stale, malformed, unauthenticated, policy-disabled, ambiguous-empty, or source-identity-mismatched responses. Record only a fixed non-personal reason code.
5. Resolve both requested times against the sessions returned for that facility. A candidate is eligible only when one exact session contains the requested time under the published boundary rule `start <= time < end` and the official response proves current individual capacity. A product-approved alternate rule may map a time between sessions to the next session, but it must be selected and disclosed before release; the MVP defaults to exact containing-session only.
6. As each atomic facility-response batch completes, select immediately if it contains an eligible candidate. Sort eligible candidates within that batch by facility priority, then time priority; a later response cannot replace the selected candidate.
7. If no observation produced an eligible candidate, close when both facility checks finish or after the 5-second deadline and stop with `예약 가능 후보 없음`; do not poll or admit a late response.
8. Treat duplicate event IDs and repeated responses for an already observed facility as replays and ignore them.
9. Revalidate the selected binding on the known official page. Acquire the single execution lock before the first state-changing form action. Burn the authorization on any later stop.
10. Never inspect or submit another candidate during the locked run.

The design deliberately distinguishes `[]` (a successful response with no rows) from not-loaded/failed data, but an empty 200 response does not by itself prove sold out or closure. Without a source-stated reason it is an ambiguous stop.

## 6. State machine

```text
IDLE
  -> COLLECTING_INPUT
  -> READY_FOR_REVIEW
  -> AUTHORIZED                 fresh one-button approval; TTL starts
  -> CHECKING_AVAILABILITY      one epoch, <=2 requests, <=4 candidates
  -> CANDIDATE_SELECTED         deterministic rank
  -> EXECUTION_LOCKED           all other candidates permanently closed for this run
  -> OFFICIAL_CALENDAR
  -> OFFICIAL_SESSION_SELECTED
  -> OFFICIAL_FORM
  -> OFFICIAL_REVIEW_VERIFIED   binding + form + agreements + no exclusions
  -> SUBMIT_DISPATCHED          one POST/submit control; authorization already consumed
  -> COMPLETION_CHECK
  -> RESERVATION_LIST_CHECK
  -> SUCCEEDED | CONFIRMATION_REQUIRED
```

Terminal/side states:

```text
COLLECTING_INPUT | READY_FOR_REVIEW -> CANCELLED
AUTHORIZED through CANDIDATE_SELECTED -> STOPPED_PRE_SUBMIT
EXECUTION_LOCKED through OFFICIAL_REVIEW_VERIFIED -> STOPPED_LOCKED
SUBMIT_DISPATCHED through verification -> CONFIRMATION_REQUIRED on any uncertainty
any nonterminal state -> EXPIRED when its applicable TTL/deadline passes
```

Invariants:

- at most one active authorization, selected candidate, execution lock, and submit dispatch per run;
- `EXECUTION_LOCKED` is irreversible;
- entering `SUBMIT_DISPATCHED` is never followed by availability checking or resubmission;
- `SUCCEEDED` requires two independently observed official signals matching the same binding;
- `STOPPED_LOCKED` and `CONFIRMATION_REQUIRED` require the user to inspect Seoul before starting a new run.

## 7. Failure and recovery behavior

| Failure/observation | System behavior | User recovery |
|---|---|---|
| Seoul login absent/expired before authorization | Do not accept authorization; show the official login page | User logs in directly and returns to review |
| Login expires after authorization | Burn authorization and stop; never capture credentials | User logs in, reviews fresh data, presses again |
| One facility check times out | Finish the epoch at 5 seconds; the timed-out facility is unknown, not unavailable | User may start a new reviewed run; no background retry |
| Empty 200 or unexplained unavailable | Mark ambiguous and exclude from selection | User may inspect Seoul manually or start a later run |
| All candidates unavailable | Stop without opening an application | User changes inputs and explicitly authorizes again |
| Known notice with exact stable ID/version | Deterministic allowlisted dismissal only | Continue within the same unexpired authorization |
| NetFunnel/waiting | Wait without refresh for up to 60 seconds, showing status | Timeout burns authorization; user decides whether to restart |
| Unknown popup, origin, path, screen, form, control, or agreement version | Fail closed before action | Manual inspection; adapter update requires new validation |
| Candidate sells out after selection | Stop locked; do not fall back | User checks Seoul, then creates a new run only after no reservation is confirmed |
| Official validation error | Stop locked and expose a non-sensitive reason category | User corrects data and performs a fresh review/authorization |
| Network error before submit dispatch | Stop locked; no candidate fallback | User confirms no reservation exists before retrying |
| Network error/timeout after submit dispatch | `확인 필요`; never resubmit | Open official reservation list and resolve manually |
| Completion page only | Continue to reservation-list check; not yet success | If list does not match, `확인 필요` |
| Reservation-list match only | Treat as success if the exact binding and a fresh run-correlated official identifier match | Otherwise `확인 필요` |
| Container/browser crash | Ephemeral data and authorization disappear | User checks the Seoul reservation list before any new run |

Recovery UI never suggests that a missing response proves failure. After the lock, its primary action is `서울 예약 내역에서 확인`, not `다시 예약`.

## 8. System architecture

```text
User
  -> review UI (non-persistent intent + exact agreements)
  -> one-time authorization broker
  -> deterministic candidate checker (read-only, <=2 facility calls)
  -> single-writer execution lock
  -> dedicated Docker Chromium
       -> Seoul-owned login/session cookie jar in browser tmpfs only
       -> deterministic official-page adapter
       -> direct field writer from ephemeral memory
       -> exact submit dispatcher
       -> completion + reservation-list verifier
       -> optional purpose-fit tiny local notice classifier (sanitized structure only)

Public collectors -> facility SQLite -> read-only facility/rule/session queries
Operational events -> fixed allowlisted codes only -> short-retention ops store
```

### Dedicated Docker browser boundary

- One isolated container/browser context per active user session; no shared browser profiles.
- Browser profile, downloads, caches, and temporary files live on `tmpfs`; no host bind mount and no crash-recovery snapshot.
- The user types Seoul credentials and OTP only into the official origin. Browser cookies remain inside the browser cookie jar and are not exposed through assistant APIs.
- Egress is deny-by-default and allowlists only independently verified Seoul/login domains plus required local control endpoints. Analytics, external model, arbitrary browsing, downloads, clipboard export, printing, screenshots, and HAR/DOM recording are disabled.
- Control messages use typed schemas and stable allowlisted IDs. The browser adapter cannot execute arbitrary selectors, JavaScript, URLs, or model-generated actions.
- The one-time lock service is the sole writer. Availability workers are read-only and lose authority when the lock is acquired.
- Container lifetime target is 20 minutes idle or 30 minutes absolute. Expiry destroys the browser process and tmpfs after reminding the user to check the official reservation list if a submit may have occurred.

## 9. Privacy data flow

| Data | Where created | Allowed path | Retention |
|---|---|---|---|
| Facility IDs, rules, sessions, public URLs | Public sources | Collector -> facility SQLite -> deterministic resolver | Per public provenance policy |
| Date, prioritized facility IDs/times, non-personal binding | Review UI | In-memory run state -> checker/lock/adapter | Until run termination; maximum 15 minutes |
| Child name, birth year/month, official sex selection, residence codes, guardian count | User input | Browser-process memory -> direct official field writer | Maximum 15 minutes; consumed before write/submit |
| Agreement ID/version/time | Review UI | In-memory approval -> exact comparison with official display | Maximum 15 minutes; consumed with authorization |
| Seoul credentials, OTP, cookies, session/auth tokens | Official browser page | User <-> Seoul origin and browser cookie jar only | Never collected or stored by this service; tmpfs ends with container |
| Applicant/guardian contact values prefilled by Seoul | Official page | Remain rendered on official page | Never copied, logged, modeled, or persisted |
| Operational telemetry | State machine | Fixed event/outcome/reason enums only | 30 days maximum, then deletion |

Prohibited everywhere outside the official browser engine: credentials, OTP, cookies/tokens, resident-registration identifiers, health/disability data, full DOM/HTML, page text containing personal values, screenshots, video, HAR bodies, request bodies, crash dumps, replay recordings, and authenticated URLs.

The personal input store must be process memory, not SQLite, `localStorage`, `sessionStorage`, IndexedDB, cookies, URL parameters, server sessions, logs, or analytics. Serialization returns only a classification marker. Sensitive-key and value-pattern checks reject telemetry before write; rejection itself records no offending key/value.

## 10. SQLite role and growth strategy

### Role

SQLite is the authoritative store for non-personal, public, provenance-sensitive facility knowledge: sources, snapshots, facilities, sessions, rules, closures, assertions, conflicts, parser versions, and expiring availability observations. It is also suitable for a physically separate tiny operational-code database. It is not a user profile, browser-session, authorization, personal-input, or reservation-result store.

The reservation container mounts the facility database read-only. Collection/migration runs in a separate process with WAL and a single writer. A vector index, if later justified, is a disposable projection over approved non-personal text and never part of the reservation decision.

### Measurable budgets

| Resource | Target | Hard/fallback threshold |
|---|---:|---:|
| Facility SQLite main file | <=150 MiB | 256 MiB; stop collection and serve last verified DB |
| SQLite WAL | <=16 MB after routine checkpoint | 32 MB; force checkpoint outside active actions |
| Index bytes | <=25% of main-file bytes | 35%; review/remove unused indexes before adding any |
| Raw body hot retention | Latest 2 distinct bodies per request and <=30 days | Offload approved public bodies to compressed evidence files; keep hash/metadata |
| Availability rows | Unexpired + 48-hour audit grace | Delete older rows daily; never use expired rows for execution |
| Operational-code DB | <=10 MB or 50,000 rows | Stop telemetry writes, not reservations; retain only in-memory counters |
| Operational event retention | 30 days | Daily deletion; shorter if legal/privacy review requires |
| Free pages | <20% of DB | Incremental vacuum when >20%; full offline rebuild when >30% |
| Backup artifact | One latest verified DB + one previous verified DB | No browser profile or personal data in backups |

The current approximately 95 MB/two-pass database establishes the baseline. At the current uncompressed growth rate, repeated full public-page snapshots would hit the 150 MiB target quickly. Before a third production-equivalent refresh cadence is enabled, implement measurement by table/index, retention deletion, WAL checkpointing, and raw-body compression/offload. Preserve `source_snapshots` hashes, timestamps, parser versions, verification state, and assertion supersession even when a permitted raw body ages out.

### Index budget and query set

Keep indexes only for measured MVP queries:

- current assertion by `(facility_id, predicate)` where not superseded;
- snapshot lookup by `(source_id, request_key, retrieved_at desc)`;
- facility rules by `(facility_id, rule_type)`;
- sessions by `(facility_id, session_kind, start_time, end_time)`;
- closures by `(facility_id, closure_date)`;
- current availability by `(facility_id, observation_date, expires_at)`;
- collection target resume by the existing unique `(source_id, target_key)`.

Use `EXPLAIN QUERY PLAN` and a representative 137-facility fixture before adding an index. Every new index must reduce a release-path p95 query by at least 20% or remove a demonstrated full scan, while staying within the index-byte budget.

### Compaction and evolution

- Run daily expiry deletion and passive WAL checkpoint; run weekly size/accounting checks.
- Use additive, checksummed migrations only. Never rewrite an applied migration.
- Rebuild the DB offline from retained source evidence if integrity check fails, index budget is exceeded, or fragmentation exceeds the threshold.
- At 400 facilities, 1 GB, or sustained write contention above one writer/5-second busy timeout, evaluate splitting raw evidence metadata from query projections. Do not adopt a server or graph/vector database merely because of row count.

## 11. Rules-first automation and optional tiny classifier

### Deterministic path

Rules own origin/path validation, screen/form/control identity, candidate ranking, date/session mapping, field allowlists, agreement matching, exclusion detection, execution locking, submit dispatch, and success verification. Every normal-path action must work with AI disabled.

### Optional classifier role

Gamma is excluded because it is too heavy for this narrow task. The default product contains no model. A future optional local text/structural classifier may be added only after deterministic rules encounter an unexpected but demonstrably non-sensitive notice before submit dispatch and only when benchmarks prove material benefit.

Permitted input is a generated structural feature object such as allowlisted origin/path class, adapter version, modal count, control-role counts, network status class, and hashes of known non-sensitive stable IDs. It receives no free text, field values, DOM/HTML, screenshot, authenticated URL, cookie, request/response body, or personal input.

Permitted output is one of:

- `known_non_sensitive_notice_candidate`;
- `netfunnel_wait_candidate`;
- `transient_network_error_candidate`;
- `layout_change_candidate`;
- `unknown_stop`.

The output is advisory. A deterministic rule must re-identify an allowlisted stable element and authorize the recovery. The classifier cannot choose/rank candidates, select dates/sessions, fill fields, interpret eligibility, infer consent, dismiss unknown dialogs, log in, submit, retry after submit, or declare completion. `unknown_stop` is the default.

### Model selection and budgets

Choose the lightest local model that passes the frozen disruption benchmark; parameter count and brand are secondary. Start with a non-neural decision table. Add a model only if it improves supported-disruption recovery by at least 10 percentage points without weakening safety.

| Measure | Acceptance target | Disable threshold |
|---|---:|---:|
| Frozen benchmark | >=500 labeled non-sensitive structural traces, including >=100 unknown/adversarial traces and all supported adapter versions | Dataset smaller or leakage review incomplete |
| Supported-class macro F1 | >=0.92 on held-out devices/layouts | <0.90 in two consecutive releases |
| Unknown/adversarial stop recall | >=0.995 | Any unsafe non-stop in release gate or <0.99 in monitoring sample |
| Sensitive-boundary tests | 0 model invocations across all sensitive fixtures | Any invocation disables the classifier |
| Compressed model artifact | <=25 MiB | >25 MiB disables the classifier |
| Packaged model plus runtime increment | <=50 MiB | >50 MiB disables the classifier |
| Incremental model RSS | <=64 MiB | >96 MiB disables the classifier |
| Cold load plus first inference | p95 <=1.5 s | >1.5 s disables the classifier |
| Warm inference | p95 <=100 ms, p99 <=200 ms | p95 >100 ms or any timeout rate >1% |
| Calls per run | 0 normal path; maximum 1 unexpected-state call | More than 1 or recursive recovery |
| Network/model telemetry | 0 bytes | Any attempted external transmission |

Model upgrades require the same frozen benchmark, privacy-boundary tests, and deterministic replay. If the model is missing, slow, OOD, low-confidence, or over budget, the behavior is exactly `unknown_stop`.

## 12. End-to-end resource budgets

Budgets apply to one active dedicated Docker browser on the MVP reference host; external Seoul/identity-provider/NetFunnel time is reported separately from internal overhead.

| Resource/latency | Target | Hard behavior |
|---|---:|---|
| Container CPU | 2 vCPU, average <1 vCPU outside page load | Throttle; no extra workers |
| Total container RSS | p95 <=1.25 GiB | 2 GiB cgroup limit; OOM/crash => `확인 필요` if locked |
| Chromium RSS | p95 <=850 MB | >1.2 GB for 60 s => stop before submit or confirmation-required after submit |
| App + deterministic adapter RSS | <=192 MB | 256 MB |
| Optional classifier incremental RSS | <=64 MiB | >96 MiB and disable the classifier |
| Writable tmpfs | <=128 MB typical | 256 MB; block downloads/cache growth and stop safely |
| Container image | <=900 MB compressed | 1.2 GB; reduce browser/model dependencies |
| Availability requests | <=2 per run, concurrency <=2 | No retries/polling; 5 s epoch deadline |
| Internal candidate ranking | p95 <=20 ms | 100 ms; stop and record fixed reason |
| Deterministic page decision | p95 <=100 ms/action | 250 ms/action |
| Internal overhead, button to submit dispatch | p95 <=1.5 s excluding official network/wait | 3 s; disable the optional classifier first |
| Button to selected official form | report p50/p95, target p95 <=10 s without queue | 30 s overall pre-submit deadline |
| NetFunnel passive wait | <=60 s, no refresh | Timeout and burn authorization |
| Post-dispatch verification | <=15 s normal | 30 s then `확인 필요` |

Resource measurements are release evidence, not estimates: record cgroup peak RSS/CPU, tmpfs high-water mark, SQLite/WAL/index bytes, request count, internal spans, and external-wait spans from synthetic accounts/fixtures without personal data.

## 13. Release gates and fallback/disable criteria

### Mandatory gates

1. Written Seoul permission covers the public availability source and the exact dedicated-browser observation/fill/final-submit method.
2. Legal/privacy review approves controller/processor characterization, lawful basis, notices, the one-button agreement/confirmation semantics, deletion evidence, incident response, and retention.
3. Exact production origin/path/screen/form/control identities and all agreement versions are independently verified on every target browser/device variant without capturing real personal data.
4. A real-device test proves direct Seoul login, date/session selection, form fill, one final submit, completion evidence, and reservation-list matching with a sanctioned test reservation and controlled cleanup.
5. Concurrency/race tests prove at most one lock and one submit under double-clicks, late facility responses, browser reconnects, process restarts, and network duplication.
6. Failure tests prove no automatic fallback after lock and no retry after dispatch or ambiguity.
7. Privacy tests prove no personal/auth data in SQLite, logs, analytics, URLs, external requests, model input, screenshots, crash reports, or persisted browser storage.
8. The optional classifier meets section 11 or ships disabled. The complete normal path passes with no model installed.
9. Facility-specific guardian/eligibility/session rules cover every enabled facility; `not_observed`, conflict, or expired knowledge disables that facility.
10. Completion and reservation-list evidence are independently matched; opening a page or dispatching a submit is never reported as success.
11. Resource tests meet section 12 on the minimum reference host for 100 consecutive fixture runs and a sanctioned connected soak.
12. `npm test`, `npm run test:knowledge`, `npm run check`, `npm run build`, and `git diff --check` pass in the release candidate.

### Automatic feature disable

Connected submission switches to preparation-only mode when any of these occurs:

- policy/legal approval is absent, expired, narrowed, or revoked;
- official origin, path, stable IDs, agreement copy/version, validation, or response semantics change;
- unknown-screen rate exceeds 1% of non-sensitive test/monitoring runs or any unsafe action is observed;
- duplicate-submit invariant fails once;
- success-verification false positive occurs once;
- privacy boundary or external-network/model leakage test fails once;
- two consecutive connected canary runs fail the same adapter step;
- container, model, latency, or database hard budget is exceeded in two consecutive release measurements.

Feature disable must not prevent the user from logging into Seoul or manually checking the reservation list. The safe fallback is a read-only/preparation summary and official calendar link, clearly stating that the assistant will not submit.

## 14. Verification plan and current verdict

### Required test layers

- Pure unit/property tests: candidate matrix, priority/tie behavior, UTC-safe dates, session boundaries, duplicates, TTLs, one-time consume, lock races, sanitizers, and state transitions.
- Offline browser fixtures: every known page, popup, validation error, changed ID/version, network transition, completion/list combination, and excluded flow.
- Privacy tests: process/storage inspection, browser tmpfs lifecycle, crash/core-dump behavior, telemetry rejection, egress denial, and optional-classifier input capture.
- Resource tests: reference Docker image with cgroup metrics and SQLite accounting.
- Sanctioned connected tests: policy-approved test identity/reservation only; no screenshots or retained personal page data.
- Operational drills: kill container before and after dispatch, lose network, expire login, receive late responses, double-click, and adapter-version rollback.

### Current verdict

The design is technically coherent and the offline fixture protocol proves only the narrow submit-control concept. The production system is not implemented, policy-approved, legally approved, device-validated, completion-validated, reservation-list-validated, or resource-benchmarked. Therefore the only honest current capability is `connected_submit_disabled`.

No product code, live submission, commit, push, or merge is authorized by this document.
