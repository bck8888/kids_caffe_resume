# One-click automatic reservation final test catalogue

Catalogue version: `ORK-RES-CAT-2026-09-06-01`
Scope: Seoul Kids Cafe one-click product in this checkout
Decision status at publication: **not ready for alpha, pilot, or release**. The repository proves an offline fixture protocol only; connected submission, target-host benchmarks, controlled live completion, and policy/legal approvals are still open.

## 1. Decision contract

This catalogue is the release authority for the one-click target: one explicit `예약하기` action may check no more than the user's 2×2 facility/time candidates and may submit exactly one matching individual reservation. It does not authorize opening-time racing, scheduled polling, payment, care, group, waitlist, cancellation, credential capture, or retrying an ambiguous submission.

Every result must identify the catalogue version, Git commit SHA plus dirty-worktree status, build artifact digest, test/fixture version, environment, device/browser/OS version, UTC start/end time, and operator. A prior report, a fixture pass, or a pass on another build/device is not a pass for the candidate under decision.

Gate codes used below:

| Code | A failure blocks |
|---|---|
| `D` | further development integration; fix before merging dependent work |
| `A` | alpha, including authenticated dry-runs |
| `P` | controlled pilot or any real reservation |
| `R` | public release |
| `—` | informative for that stage; failure is still recorded |

Automation levels: `CI` = deterministic on every change; `Nightly` = scheduled isolated job; `Harness` = automated host/fixture runner with assertions; `Manual-witnessed` = two-person witnessed procedure; `External-record` = signed policy/legal/partner evidence. “Automated” never means permitted to touch the live submit control.

### Verdict algorithm

1. A stage is `BLOCKED` if any item containing its gate code is missing, stale, skipped, inconclusive, or failed.
2. `PASS` requires the expected evidence artifact, not a verbal assertion. An ambiguous observation is not a pass.
3. Alpha is offline or authenticated staging/dry-run only; its capability must remain `connected_submit_disabled`.
4. Pilot requires all `D/A/P` items, named policy/legal approvals, an approved real-reservation window, and the controlled-live stop conditions in this document.
5. Release requires every `D/A/P/R` item on every supported target-device/browser matrix, plus zero unresolved severity-1/2 defects and zero privacy/security exceptions.
6. Any official page, agreement, selector, endpoint, policy, host permission, or supported-browser change invalidates affected evidence and triggers the mapped contract/fixture/security tests again.

## 2. Mandatory benchmark protocol and budgets

These are acceptance budgets, not claims that current hardware has passed. The existing coverage note says a local database was approximately 95 MB, but no result is accepted until the method below produces a fresh machine-readable report.

### Reference matrices

- `DEV-REF`: clean Linux/arm64 and Linux/x64 container runners with 2 vCPU and 2 GiB RAM.
- `MOB-LOW`: the oldest/lowest-memory Android and iOS devices proposed for support.
- `MOB-MID`: one current mid-range Android and one current iPhone.
- `BROWSER`: dedicated host WebView plus every supported mobile browser context; Kakao in-app browser is tested as an entry path, not assumed capable of cross-origin assistance.
- Record exact CPU/SoC, RAM, thermal state, battery state, power mode, OS, runtime, browser/WebView, network shaping, and whether the run is cold or warm.

### Method

1. Build once in release mode; record source/build/container/model/fixture SHA-256 digests.
2. Reset caches for cold runs and preserve caches for warm runs. Run 5 warm-ups, then 30 measured repetitions per device/configuration; query latency uses 1,000 seeded calls after 100 warm-ups.
3. Seed the SQLite database from a pinned public-source snapshot representing 137 facilities, two collection versions, the current month, and worst-case indexed history. Repeat with a synthetic 10× history-growth set to expose nonlinear behavior; synthetic rows are clearly labeled and never treated as facility facts.
4. Measure wall-clock time with a monotonic clock. Measure process/container peak RSS and on-device host/model incremental peak RSS; sample at no slower than 100 ms. Report p50/p95/p99, maximum, failures, and raw JSON/CSV.
5. On-device inference runs locally with airplane mode enabled after fixtures are installed. Use the frozen popup/screen corpus, randomized order, one inference at a time, and both cold-model-load and warm-inference measurements.
6. Resource runs fail if the operating system kills/throttles the process, more than 1% of samples error, or thermal throttling invalidates the configured run. Reruns must retain the failed artifact and state the reason.

### Budgets

| Metric | Required threshold | Gate |
|---|---:|---|
| Authoritative SQLite file after pinned two-pass 137-facility collection | `≤ 150 MiB` | A/P/R |
| SQLite file after synthetic 10× history | `≤ 750 MiB` and `PRAGMA integrity_check = ok` | P/R |
| Common indexed facility/rule/current-availability query | warm `p95 ≤ 50 ms`, `p99 ≤ 100 ms` | A/P/R |
| 2×2 candidate availability decision, including four DB lookups | warm `p95 ≤ 200 ms`, `p99 ≤ 400 ms` excluding network | A/P/R |
| Container cold ready time (`process start` to health-ready) | `p95 ≤ 3.0 s`, max `≤ 5.0 s` | A/P/R |
| On-device host cold ready time, model excluded/included | deterministic core `p95 ≤ 1.0 s`; with model `p95 ≤ 2.0 s` | P/R |
| Server/container peak RSS under 20 concurrent dry-run journeys | `≤ 384 MiB`, no OOM/restart | A/P/R |
| On-device assistant incremental peak RSS | `≤ 192 MiB` on `MOB-LOW`, `≤ 256 MiB` on `MOB-MID` | P/R |
| Compressed local model artifact | `≤ 25 MiB`; total packaged model/runtime increment `≤ 50 MiB` | P/R |
| Warm local-model inference | `p95 ≤ 100 ms`, `p99 ≤ 200 ms` on `MOB-LOW`; zero network calls | P/R |
| Cold model load plus first inference | `p95 ≤ 1.5 s` on `MOB-LOW` | P/R |
| Battery/thermal soak | 20 fixture journeys in 30 min consume `≤ 3 percentage points` battery, no serious thermal warning | P/R |

## 3. Unit and pure decision tests

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `UT-001` | Valid and boundary-invalid `YYYY-MM-DD` cases across UTC±14 | Exercise reservation day-number calculation | Valid dates map to UTC weekday + 1; impossible dates are rejected before lookup | JUnit/TAP cases with timezone matrix | CI | D/A/P/R |
| `UT-002` | Slots include containing, sold-out, later, malformed, and overlapping entries | Run slot candidate selection for boundary times | At most two available choices; containing slot first, then next available; sold-out/malformed excluded | Serialized input/output vectors | CI | D/A/P/R |
| `UT-003` | No slot contains requested time | Select candidates | First later available is labeled `next_available`, second `following_available`; none means explicit no-choice | TAP plus snapshot | CI | D/A/P/R |
| `UT-004` | Two facilities × two times, all four simultaneously available | Rank candidates | Exact order is F1/T1, F1/T2, F2/T1, F2/T2 | Table-driven ranking trace | CI | D/A/P/R |
| `UT-005` | 2×2 candidates become available in different observations | Feed observation sequence where lower-priority candidate is seen first | First candidate actually observed reservable wins; priority only breaks ties within one atomic observation | Deterministic sequence trace | CI | D/A/P/R |
| `UT-006` | One facility or one time omitted | Generate candidate matrix | Only configured combinations exist; no fabricated facility/time and no duplicate candidate | Candidate JSON | CI | D/A/P/R |
| `UT-007` | More than two facilities/times or repeated IDs supplied | Validate request | Reject or normalize to explicit unique maximum of four before any availability call | Validation results | CI | D/A/P/R |
| `UT-008` | Individual reservation with one child and a facility rule saying guardians total includes applicant, max 2 | Compute official guardian value | `1` = applicant alone; `2` = applicant + one accompanying guardian; never add applicant again | Rule fixture and asserted field value | CI | D/A/P/R |
| `UT-009` | Guardian rule absent, stale, conflicting, or for another facility | Compute default | Return `확인 필요`; do not infer global 2 or submit | Reason-coded result | CI | D/A/P/R |
| `UT-010` | Intent at 59:59, 60:00, invalid clock/date/slot, or unknown action | Validate intent | Only well-formed, unexpired, allowlisted intent passes; `stop` remains mandatory | Boundary test output | CI | D/A/P/R |
| `UT-011` | Ephemeral input at 14:59 and 15:00, explicit clear, consume twice | Load/clear/consume | Available only before TTL, cleared on expiry, and returned once | TAP and heap-object serialization check | CI | D/A/P/R |
| `UT-012` | Submit authorization at 01:59.999 and 02:00.000 | Consume authorization | Valid strictly before expiry; expired/missing is burned with zero writes | Writer spy and authorization-state trace | CI | D/A/P/R |
| `UT-013` | Facility/date/slot/child/guardian differ individually | Compare authorization, intent, and observation | Every mismatch stops before first field write | Mutation matrix with zero-call assertion | CI | D/A/P/R |
| `UT-014` | Valid, missing, duplicate, unknown, reordered, and version-changed agreements | Validate approval set | Exactly SMS receipt, personal data, and terms, each explicitly approved at the displayed version; reordering alone is accepted | Agreement matrix | CI | D/A/P/R |
| `UT-015` | Unknown screen, malformed URL, non-official origin, unallowlisted action | Plan action | Deterministic `stop`; no click, field write, model/cloud call, or submit | Action and side-effect spies | CI | D/A/P/R |
| `UT-016` | Completion-like text appears in popup/body but completion identity is absent | Classify screen | Not complete; stop or request manual verification | Adversarial corpus output | CI | D/A/P/R |

## 4. Protocol and official-page contract tests

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `CT-001` | Frozen authorization schema and independently generated consumer fixtures | Encode/decode valid and invalid messages | Schema version, TTL, ID, binding, and agreement versions round-trip; unknown/extra security-sensitive fields reject | JSON Schema results and compatibility matrix | CI | D/A/P/R |
| `CT-002` | Known offline review fixture | Mutate origin, path, screen ID, form ID, method, action, and submit-control ID one at a time | Only exact HTTPS official-origin/known-review contract can reach writer | Mutation report | CI | D/A/P/R |
| `CT-003` | Known form plus payment, care, group, waitlist, cancellation variants | Execute protocol | Every excluded flow stops and consumes the attempt without writes | Variant results and writer log | CI | D/A/P/R |
| `CT-004` | Pending client/server validation errors, disabled/hidden submit, or missing required control | Execute protocol | Stop before writes; no attempt to bypass official validation | DOM-contract assertion log without personal content | Harness | D/A/P/R |
| `CT-005` | Official field-map fixture for Seoul and non-Seoul residence branches | Fill approved fields | Only the branch-specific exact fields are written; no hidden unrelated fields touched | Field-write allowlist trace | Harness | A/P/R |
| `CT-006` | Current official calendar contract fixture | Choose candidate | Facility/year/month/date/day/session/use-type/capacity values correspond exactly to selected intent | Sanitized field-name/value-class trace and fixture digest | Harness | A/P/R |
| `CT-007` | Official contract changes any selector, label, agreement copy/version, form action, or completion identity | Run drift detector | Capability fails closed and evidence is invalidated; no heuristic submit fallback | Drift diff and stop code | Nightly | A/P/R |
| `CT-008` | Ordinary PWA/web runtime without approved host | Request connected submit | Capability remains `connected_submit_disabled`; official page may open only as manual preparation flow | Capability manifest and negative E2E | CI | A/P/R |
| `CT-009` | Host adapter receives applicant values | Trace IPC/API boundary | Values travel only from ephemeral memory directly to official-page writer; no service/backend endpoint exists in path | Data-flow trace and network assertion | Harness | A/P/R |
| `CT-010` | Two concurrent authorizations with same or different 2×2 request | Attempt both | Request-level lock permits at most one execution path; others stop before selection/write | Concurrency trace with one winner | CI | D/A/P/R |

## 5. Facility database and public-data quality

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `DB-001` | Empty temp DB and numbered migrations | Apply migrations twice and verify checksums/foreign keys | First application succeeds; second is no-op; checksum drift or FK violation fails | Migration log plus `integrity_check`/`foreign_key_check` | CI | D/A/P/R |
| `DB-002` | Pinned Seoul Open API fixture with 137 unique IDs | Collect/normalize | 137 facilities and unique stable IDs; secret URL portion redacted; raw snapshot/hash/parser provenance retained | Counts, duplicate query, redacted snapshot metadata | CI | D/A/P/R |
| `DB-003` | Two identical public collection passes plus resume pass | Collect, retry, resume | No duplicate assertion/program/equipment links; successful targets skip unless refresh; run remains replayable | Before/after table counts and target states | CI | D/A/P/R |
| `DB-004` | Changed public value in second snapshot | Normalize and project | New append-only assertion supersedes old; raw history remains; no destructive rewrite | Assertion lineage query | CI | D/A/P/R |
| `DB-005` | Conflicting source claims | Ingest both | Conflict stays explicit and unresolved; selection logic cannot treat either as confirmed without policy | Conflict rows and decision stop | CI | D/A/P/R |
| `DB-006` | Explicit holiday/maintenance reason and plain `예약불가`/empty-200 fixtures | Normalize calendar | Explicit reason becomes dated closure; reasonless unavailable/empty success remains `unknown` with ambiguity reason, never sold-out/holiday | Normalized rows and source hashes | CI | D/A/P/R |
| `DB-007` | Capacity/waiting combinations | Normalize availability | `sold_out` derives only from sufficient capacity evidence; waitlist is separate and excluded from v1 | Table-driven rows | CI | D/A/P/R |
| `DB-008` | Six-hour availability TTL boundary | Query at pre/post expiry | Pre-expiry observation is usable; expired observation cannot trigger selection and forces refresh/stop | Clock-controlled query output | CI | D/A/P/R |
| `DB-009` | Missing page field/equipment | Produce coverage | Missing is `not_observed`, never `confirmed_absent`; connected recommendations remain off below approved coverage | Coverage JSON and feature flag | CI | A/P/R |
| `DB-010` | Repository methods receive nested credential, auth, applicant, child, guardian, DOM, screenshot keys | Attempt SQL write | Reject before SQL execution; transaction and DB counts unchanged | Injection corpus and before/after DB digest | CI | D/A/P/R |
| `DB-011` | Collector configured for public pages | Observe HTTP requests | Unauthenticated only, ≥250 ms spacing, bounded retry/backoff, no cookie/auth header, no authenticated URL archive | Mock-server request ledger | CI | A/P/R |
| `DB-012` | Current facility-specific guardian/rule evidence | Query rule used by reservation | Rule is unexpired/current, facility-bound, provenance-backed, non-conflicting; otherwise `확인 필요` | Decision query with assertion/snapshot IDs | Harness | P/R |
| `DB-013` | Pinned database and 10× history dataset | Run benchmark protocol | Meets all DB size, integrity, and query budgets in section 2 | Raw benchmark JSON/CSV and summarized percentiles | Nightly | A/P/R |

## 6. Resource, startup, model, and load tests

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `PF-001` | Release container on `DEV-REF`, cold cache | Start 30 times and probe readiness | Cold startup meets `p95 ≤ 3.0 s`, max `≤ 5.0 s`; health is false until dependencies ready | Timestamped raw samples | Nightly | A/P/R |
| `PF-002` | 20 concurrent dry-run journeys for 30 min | Run load with failures/timeouts injected | Peak RSS `≤ 384 MiB`, no OOM/restart, no duplicate execution, error rate `≤ 1%` | Container metrics and journey IDs | Nightly | A/P/R |
| `PF-003` | Frozen candidate set and pinned DB | Execute 1,000 2×2 decisions | Meets query and `p95 ≤ 200 ms`/`p99 ≤ 400 ms` candidate budgets, deterministic winner | Raw timings plus winner hash | Nightly | A/P/R |
| `PF-004` | Signed local model candidate on `MOB-LOW/MID` | Measure artifact/runtime size and 30 cold loads | Model `≤ 25 MiB`, package increment `≤ 50 MiB`, cold ready/first inference budgets pass | Package diff and timing report | Harness | P/R |
| `PF-005` | Frozen known/unknown popup corpus, airplane mode | Run warm inference after five warm-ups | `p95 ≤ 100 ms`, `p99 ≤ 200 ms`, zero network, and classification safety metrics meet `ML-001` | Per-example predictions/timings and packet capture | Harness | P/R |
| `PF-006` | 20 representative fixture journeys on each target phone | Run 30-minute battery/thermal/RSS soak | Battery loss `≤ 3 points`, no serious thermal warning, incremental RSS within section 2 | Device energy/thermal/RSS export | Manual-witnessed | P/R |
| `PF-007` | Slow/offline/500/429 public availability service | Exercise bounded lookup | UI/host stays responsive; no high-frequency retry; stop/manual fallback within 10 s and no submit | Network-shaping trace | Harness | A/P/R |

## 7. Offline official-page fixture and popup corpus

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `FX-001` | Offline fixture package with verified hashes and no personal data | Run normal individual path | Exact date/session/party/agreement identity is reviewed, allowed fields filled, one exact fixture submit dispatched | DOM-free action trace and fixture digest | Harness | A/P/R |
| `FX-002` | Calendar no-show notice variants: desktop/mobile markup, close button, “7 days”, reordered controls | Observe/dismiss | Only each independently allowlisted stable popup ID plus expected semantics may dismiss | Popup-ID/action matrix | Harness | A/P/R |
| `FX-003` | Semantic lookalike or changed popup with same text but missing/mismatched ID | Observe | Stop; generic text or close control alone never dismisses | Adversarial trace | Harness | D/A/P/R |
| `FX-004` | Native capacity alert, final-submit confirmation, NetFunnel waiting, maintenance notice | Traverse each | Capacity/confirmation handled only at expected step; NetFunnel waits without losing lock; maintenance stops; none mistaken for no-show notice | State-transition trace | Harness | A/P/R |
| `FX-005` | Login-required fixture then valid return | Resume | User performs login; intent survives within TTL; facility/date/slot/party revalidated before continuation | Sanitized transition trace | Harness | A/P/R |
| `FX-006` | Login expires before form, during waiting, and immediately before submit | Traverse | Stop/request official login; current authorization is burned; resumption needs a fresh explicit button approval | Authorization/side-effect trace | Harness | A/P/R |
| `FX-007` | Unknown overlay/screen/control order/iframe boundary | Observe repeatedly | `unknown_screen` and zero click/write/submit; no model confidence may override exact submit identity | Side-effect spies and reason code | Harness | D/A/P/R |
| `FX-008` | Explicit holiday fixture and reasonless unavailable/empty fixture | Check same candidate | Holiday shows source-stated closure; ambiguous shows `확인 필요`; neither is silently converted to sold-out or submitted | UI/state snapshots containing synthetic data only | Harness | A/P/R |
| `FX-009` | Simultaneously available 2×2 fixture | Run one-click flow | F1/T1 wins, all other candidates lock, exactly one submit call | Atomic observation and lock trace | Harness | A/P/R |
| `FX-010` | F2/T2 becomes available first; higher-priority candidates remain unknown until later | Feed ordered observations | F2/T2 is selected immediately as first observed available; later priority does not replace or add submission | Timestamped decision trace | Harness | A/P/R |
| `FX-011` | Candidate becomes sold out between selection and review | Revalidate at final boundary | Stop with stale-availability reason, burn attempt, no alternative auto-submit; require a new user action | State and submit-call count | Harness | A/P/R |
| `FX-012` | Field writer throws after 0, 1, or N writes; submit dispatch returns/throws/connection drops | Execute | Attempt stays consumed and locked; result becomes ambiguous when dispatch may have occurred; never automatic resubmit | Fault-injection trace | Harness | D/A/P/R |
| `FX-013` | Completion-text, error-text, and reservation-list fixtures | Verify outcome | Completion requires exact completion identity plus separate matching reservation-list record; disagreement is `확인 필요` | Dual-source verification trace | Harness | A/P/R |

## 8. Security and privacy tests

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `SP-001` | Canary values for child/name/birth/residence/guardian plus credential/token/OTP/cookie/DOM/screenshot aliases | Run full offline journey; scan filesystem, DB, logs, stdout/stderr, crash report, storage, caches | Zero canary outside in-memory store and direct official writer; prohibited values absent everywhere | Automated canary scan manifest | CI/Harness | D/A/P/R |
| `SP-002` | Browser storage/server/network spies enabled | Create, reload, navigate, crash, expire, clear, consume | Ephemeral values never enter local/session storage, IndexedDB, cookies, URL, request, server, or durable cache; disappear on every clearing event | Storage/network/heap-liveness assertions | Harness | D/A/P/R |
| `SP-003` | Backend and analytics capture all requests/events in test | Complete and fail journeys | Server receives zero applicant/child/residence/guardian/agreement-value/page-content data; only allowlisted fixed operational codes, if enabled | Server request ledger with zero sensitive-key hits | Harness | D/A/P/R |
| `SP-004` | Nested, Unicode/confusable, case, separator, and alias variants of sensitive keys | Send to sanitizer/repository/error handler | Whole payload rejected before projection/write; not merely redacted after logging | Fuzz corpus and zero-write proof | CI | D/A/P/R |
| `SP-005` | Serialize stores, authorization, results, exceptions, and diagnostics | Inspect output | No personal values; `toJSON` reveals classification only; stack/errors contain fixed codes | Snapshot and canary scan | CI | D/A/P/R |
| `SP-006` | Proxy/packet capture on host, airplane-mode model run | Execute classification and form fill | No external model/telemetry/third-party endpoint receives UI/applicant data; model inference is local | Packet capture and dependency call graph | Harness | A/P/R |
| `SP-007` | Malicious official-like page, mixed content, redirect, subdomain, punycode, changed form action | Attempt flow | Exact HTTPS origin/path/form gates stop all variants; no writes before validation | Origin attack matrix | CI/Harness | D/A/P/R |
| `SP-008` | Dependency SBOM, licenses, runtime permissions, telemetry defaults | Scan release image/app | No critical/high exploitable finding, undeclared telemetry, excessive accessibility/browser permission, or forbidden license; exceptions are not allowed for pilot/release | Signed SBOM and security report | Nightly | A/P/R |
| `SP-009` | Support/crash/replay tooling enabled in a non-production test | Trigger failures with canaries | Screenshots, DOM dumps, request bodies, authenticated URLs, and personal values are excluded or tool disabled | Tool configuration plus canary scan | Harness | A/P/R |
| `SP-010` | User invokes clear/withdrawal before submit | Clear all local state | Ephemeral input and authorization unavailable immediately; no server deletion needed because server collection is zero | Memory/store state and empty server ledger | Harness | A/P/R |

## 9. Docker and browser/host integration

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `HB-001` | Reproducible Docker build from clean checkout | Build twice | Image digests match or documented nondeterministic metadata is isolated; no `.env.local`, keys, DB, fixtures with personal data, or dev caches in layers | Layer inventory/SBOM/secret scan | CI | A/P/R |
| `HB-002` | Container as non-root with read-only root FS, tmpfs scratch, resource limits | Start and run dry journey | App healthy without privilege escalation or host secrets; write attempts stay in approved scratch | Runtime security report | Harness | A/P/R |
| `HB-003` | Host killed/restarted at every state boundary | Resume/reopen | No personal recovery from disk, no stale authorization, no submit replay; user must explicitly restart | Restart matrix | Harness | A/P/R |
| `HB-004` | Supported WebView/browser matrix with offline fixtures | Run same corpus | Identical fail-closed decisions and exact write/submit count across targets | Matrix report keyed by versions | Harness | A/P/R |
| `HB-005` | Kakao in-app browser and normal Safari/Chrome entry paths | Open dedicated host/manual fallback | Correct context transition is documented; ordinary browser is never misrepresented as having host capability | Sanitized navigation log | Manual-witnessed | A/P/R |
| `HB-006` | Accessibility permission denied/revoked mid-flow or browser host backgrounded | Traverse | Stop safely, consume/burn uncertain attempt, expose manual verification; no background retry | Permission-state trace | Harness | A/P/R |
| `HB-007` | Two tabs/windows and back/forward navigation | Trigger same request in both | One request-level lock; stale tab cannot write or submit; completion state cannot be forged by history navigation | Cross-tab lock trace | Harness | A/P/R |
| `HB-008` | CSP, TLS interception failure, clock skew ±10 min, locale/timezone variants | Run dry journey | Unsafe TLS/CSP stops; authoritative monotonic/UTC expiry works; date/slot identity unchanged across locale/timezone | Environment matrix | Harness | A/P/R |

## 10. Authenticated staging and dry-run tests

Authenticated tests use purpose-built test accounts and synthetic applicant values only where Seoul provides an approved staging environment. If staging does not exist, use a locally controlled replica; do not call production submit. Credentials are typed by the operator on the official origin and are never captured in evidence.

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `AS-001` | Approved staging/replica, test account, connected submit disabled | Log in manually and traverse to review | Account/session stays official-side; assistant detects only state, restores exact intent, and performs zero submit | Sanitized state/URL-class trace, submit count 0 | Manual-witnessed | A/P/R |
| `AS-002` | Session expires at each boundary | Continue | Requests official login, preserves only non-personal intent within TTL, burns submit authorization, and requires fresh authorization after return | Boundary matrix | Manual-witnessed | A/P/R |
| `AS-003` | Official account-prefilled contact/guardian values present | Compare without recording values | Presence/validity may be confirmed locally; values are not copied to logs, server, evidence, or model | Boolean-only assertion trace and canary audit | Manual-witnessed | A/P/R |
| `AS-004` | Current facility rules and synthetic one-child input | Dry fill review form | Guardian total includes applicant and stays within facility rule; child/residence branch fields and all agreements match | Redacted field-name/status checklist | Manual-witnessed | P/R |
| `AS-005` | Every known popup/alert/waiting variant available in staging/replica | Traverse | Known stable IDs behave as fixture contract; unknown variants stop and generate drift report without capture | Variant IDs, hashes, reason codes | Manual-witnessed | A/P/R |
| `AS-006` | Network lost before form, during field fill, before submit, after dry submit interception | Inject failures | No silent retry or alternate candidate; ambiguous state locks request and routes to verification | Fault timeline and request lock state | Harness | A/P/R |
| `AS-007` | Dry-run interceptor replaces final network dispatch | Press one explicit reservation button | Exactly one intercepted POST intent for exact bound candidate; no other candidate/request; authorization/input consumed beforehand | Interceptor ledger and zero-sensitive server ledger | Manual-witnessed | P/R |
| `AS-008` | Production hostname configured accidentally during alpha | Start suite | Hard fail before authentication/navigation; no production request | Egress deny log | CI/Harness | A/P/R |

## 11. Controlled live reservation pilot

No item in this section may run until all `D/A/P` prerequisites pass and `PL-001` through `PL-008` are signed. Use one named adult guardian, one eligible child, one approved facility/date/time, and a genuine intended visit. Never create a disposable or speculative reservation. The operator types credentials on the official origin; evidence contains no personal values, authenticated URLs, DOM, screenshots, or session material.

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `LV-001` | Written live-window approval, valid session, current rules/availability, explicit participant consent, rollback/cancellation handled manually by participant | Run one 2×2 check with final host submit disabled | Candidate order/first-observed behavior and review values are correct; zero submit | Witness checklist with pseudonymous run ID | Manual-witnessed | P/R |
| `LV-002` | Separate written approval to enable exactly one live submit; all values reviewed; no excluded flow | User presses one explicit reservation button | At most one exact official submission; all other candidates lock before dispatch; no automation after dispatch | Two-witness timing ledger, fixed reason/status codes, official non-personal receipt reference | Manual-witnessed | P/R |
| `LV-003` | Live dispatch times out/disconnects or response is unclear | Observe without retry | State becomes `확인 필요`; zero resubmit and zero alternative-candidate submit, even after restart/back/reopen | Request-lock audit and verification checklist | Manual-witnessed | P/R |
| `LV-004` | Official completion response available | Verify completion page then reservation list independently | Both match facility/date/slot/party/run; only then mark complete; mismatch/absence stays `확인 필요` | Operator-attested result with non-personal official reference and timestamps | Manual-witnessed | P/R |
| `LV-005` | Session expires, popup drifts, validation appears, rules/availability change, or unknown screen occurs before dispatch | Continue | Stop, burn authorization, make no live submission, and require a new approved run | Stop-condition ledger | Manual-witnessed | P/R |
| `LV-006` | First successful controlled booking completed | Review logs/storage/server/official effects | Exactly one reservation, zero sensitive server collection, no duplicate/secondary candidate, and visit/cancellation responsibilities communicated | Post-run audit signed by privacy and operations owners | Manual-witnessed | P/R |

Pilot stop rule: any unexpected write, duplicate, ambiguous dispatch, sensitive-data observation, official warning, policy question, selector drift, or inability to independently verify the reservation immediately disables connected submit. Further live attempts require incident review and a new written approval; they are never automatic retries.

## 12. Failure, replay, idempotency, and completion verification

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `FR-001` | Same authorization invoked sequentially and concurrently | Execute 100 replay attempts | Exactly one path may dispatch; 99 stop; authorization and input are one-use | Concurrency/replay ledger | CI | D/A/P/R |
| `FR-002` | Same request re-created with a new authorization while prior outcome is ambiguous | Attempt execution | Request-level ambiguity lock rejects it; only verified no-submission plus explicit human reset can create a new run | State-machine trace | CI/Harness | D/A/P/R |
| `FR-003` | Process crashes before consume, after consume, after writes, and during dispatch | Restart | No durable personal recovery and no automatic resubmit; post-consume states are stopped/ambiguous and require verification | Crash-point matrix | Harness | D/A/P/R |
| `FR-004` | Availability response duplicated, reordered, delayed, or replayed | Feed events | Event/request IDs deduplicate; stale observations cannot replace fresh state or create a second winner | Event trace | CI | D/A/P/R |
| `FR-005` | 429/5xx/timeouts from availability/calendar | Retry lookup | Bounded backoff only for read-only pre-dispatch calls; expired TTL stops; submit is never retried | Mock-server request counts/timing | CI/Harness | D/A/P/R |
| `FR-006` | Completion page says success but reservation list lacks match, and inverse case | Verify | `확인 필요`; never complete and never resubmit | Verification matrix | Harness | A/P/R |
| `FR-007` | Two matching reservation-list records or mismatched party/slot | Verify | Ambiguous/conflict state; manual official review required | Matching trace using synthetic IDs | Harness | A/P/R |
| `FR-008` | Completion identity and reservation-list record both exact | Verify twice/restart | Complete once, idempotently; no new submit side effect | Verification/event count | Harness | A/P/R |
| `FR-009` | User cancels/exits before explicit button or before dispatch | Abort | All local personal/authorization state clears; zero submission; no background task | Side-effect and storage scan | Harness | A/P/R |
| `FR-010` | Candidate lock service unavailable | Try one-click flow | Fail closed before writer/submit; local best-effort lock is not accepted for connected mode | Failure trace | Harness | P/R |

## 13. Model safety tests

The deterministic adapter remains authoritative. A local model may classify an unknown notice for escalation but may never directly authorize submit, arbitrary click, agreement, credential handling, or completion.

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `ML-001` | Frozen, independently labeled corpus containing every known popup plus at least 2× as many adversarial/unknown screens | Evaluate model | 100% recall for `unknown/stop` safety class; 0 unsafe-action false positives; known-popup macro F1 ≥ 0.98; otherwise model disabled | Dataset card, label provenance, confusion matrix | Harness | P/R |
| `ML-002` | Corrupted, missing, wrong-version, or wrong-hash model | Start host | Deterministic path remains available; unknowns stop; no model download or fallback cloud call | Tamper matrix/network trace | Harness | P/R |
| `ML-003` | UI text contains prompt-injection-like instructions, personal values, or completion claims | Classify minimal sanitized features | Instructions are data, never executed; personal/raw text excluded; result cannot exceed `stop/escalate` | Adversarial output and input-schema trace | Harness | P/R |
| `ML-004` | Model update candidate | Compare against frozen prior corpus and new drift corpus | All safety, latency, size, memory, and offline gates rerun; no silent rollout | Signed model card and gate bundle | Manual-witnessed | P/R |

## 14. Policy, legal, privacy, and operational gates

| ID | Precondition | Action | Expected result | Required evidence | Automation | Blocks |
|---|---|---|---|---|---|---|
| `PL-001` | Exact UMPPA slot/calendar endpoints and proposed request rate documented | Obtain Seoul/operator determination | Written permission covers production read-only use, rate, retention, and attribution; otherwise connected lookup stays off | Dated approval/decision record | External-record | P/R |
| `PL-002` | Exact host runtime, page observation, field fill, popup dismissal, and one-click submit described | Obtain Seoul/operator automation determination | Written scope explicitly permits each enabled action; silence/general website access is not approval | Dated signed record mapped to capabilities | External-record | P/R |
| `PL-003` | Controller/processor/data-flow map and zero-server-collection design | Legal/privacy review | Lawful basis, roles, notices, retention/deletion, incident handling, data-subject rights, cross-border/vendor status approved | Counsel/privacy sign-off | External-record | P/R |
| `PL-004` | Exact current SMS, personal-data, and terms copy/version plus one-click UX | Legal/UX review | Determines whether approvals must be separate and how explicit consent is captured; no bundling/inference without approval | Versioned consent opinion and approved copy | External-record | P/R |
| `PL-005` | Target Android/iOS host permissions and store disclosures | Platform/store-policy review | Accessibility/WebView/automation use, background behavior, and disclosures are permitted for exact implementation | Platform review record | External-record | P/R |
| `PL-006` | Security threat model, SBOM, penetration results, incident runbook | Security owner review | No open critical/high issue; kill switch and incident contacts tested | Signed security acceptance | External-record | P/R |
| `PL-007` | Live pilot protocol, genuine-booking rule, participant notice/consent, stop criteria | Operations/privacy approval | Named owners, window, facility, maximum attempts (`1`), monitoring, and manual cancellation responsibility approved | Signed pilot authorization | External-record | P |
| `PL-008` | Public claims and UI copy | Truthfulness review | Clearly distinguishes preparation, offline proof, pilot, and released capability; never claims completion before dual verification | Approved copy/version | External-record | A/P/R |
| `PL-009` | Facility-specific rules and source freshness policy | Product/legal review | Defines acceptable age/residency/guardian/evidence sources and expiry; missing/conflict produces `확인 필요` | Approved decision policy | External-record | P/R |
| `PL-010` | Operational telemetry proposal | Privacy/security review | Fixed-code, non-identifying, shortest-retention telemetry only; zero collection remains default until explicitly approved | Schema, retention job evidence, approval | External-record | P/R |
| `PL-011` | Partnership/API option assessed | Record decision | Seoul-supported API is preferred when available; host automation is not released if a binding restriction or safer required integration conflicts | Architecture/policy decision record | External-record | R |
| `PL-012` | All pilot evidence and incidents reviewed | Release review board | Every `R` gate passes on supported matrix; kill switch, support, monitoring, and revalidation owners are active | Signed release decision with catalogue version | External-record | R |

## 15. Evidence bundle and final readiness report

The immutable bundle for a decision is stored outside source control when it could contain operational details. It contains no credentials, authenticated URLs, DOM/HTML, screenshots, personal values, or session material. Required index fields:

```text
catalogue_id, test_id, result(PASS|FAIL|BLOCKED|INCONCLUSIVE), gate_codes,
commit_sha, dirty_state, build_digest, container_digest, fixture_digest,
model_digest_or_none, environment_id, device_browser_os, started_at_utc,
finished_at_utc, operator, evidence_paths_and_sha256, defect_ids, expiry_or_revalidation_trigger
```

The final report must list every catalogue ID exactly once and compute four independent verdicts: `development`, `alpha`, `pilot`, and `release`. It must call out unexecuted live tests and external approvals as `BLOCKED`, not `N/A`, whenever their gate code applies. Raw benchmark samples and sanitized state-machine traces are retained with the report; personal-data screenshots are never acceptable evidence.

### Current honest conclusion

- Development may continue behind the offline fixture and `connected_submit_disabled` boundary, subject to fresh `D` gate results.
- Alpha is blocked until the complete offline, Docker/host, privacy, and authenticated dry-run evidence set passes on the candidate build.
- Pilot is blocked until target-device benchmarks, policy/legal approvals, exact agreement handling, and the witnessed staging/dry-run gates pass.
- Release is blocked until the controlled live sequence proves exactly-once submission and dual completion verification, followed by all-device regression and signed release approval.
