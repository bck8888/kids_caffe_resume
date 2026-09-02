# Alpha test results

Last updated: 2026-09-02 KST

## Current status

The earlier A-01 through A-16 result set is superseded. It tested the previous long-card UI and included claims that are incompatible with the reset product goal.

In particular:

- The earlier result mixed a requested `12:30` scenario with a restored `11:00` OAuth state. That does not prove exact intent restoration.
- The earlier official-handoff result treated a result-style `BD_selectKidsCafeResveRs.do` URL with date/slot parameters and HTTP 200 as success. Public official-page inspection shows that the correct entry page is `BD_selectKidsCafeResveCal.do`, while date and slot are page-local form state.
- Fixture equipment tags proved only a synthetic algorithm path, not connected recommendation coverage.
- The previous 390x844 layout result predates the redesigned staged flow.

Those results remain historical debugging evidence but are not current MVP completion evidence.

## Current automated evidence

| Gate | Status | Evidence |
|---|---|---|
| TypeScript | Pass | `npm run check` |
| Unit tests | Pass | 26 tests, including three official calendar URL tests |
| Production build | Pass | `npm run build` |
| Diff whitespace | Pass | `git diff --check` |
| Local server reachability | Pass | `http://localhost:3000` returned HTTP 200 |

## Current scenario evidence

| ID | Status | Evidence |
|---|---|---|
| G-01 | Automated code evidence | Facility restoration falls back to no selection instead of the first loaded facility; visual confirmation pending |
| G-02 | Automated code evidence | Facility list is rendered only inside the explicit picker and limited to eight results; visual confirmation pending |
| G-03 | Automated code evidence | Facility selection closes the picker and enables the next step; interaction confirmation pending |
| G-04 | Automated code evidence | Favorite updates persist immediately and enforce a maximum of three; interaction confirmation pending |
| G-05 | Pass | Slot-selection unit test covers the containing slot plus next available slot |
| G-06 | Pass | Slot-selection unit tests cover between-slot selection and sold-out exclusion |
| G-07 | Not retested | Previous OAuth evidence used different expected and restored-time scenarios |
| G-08 | Automated code evidence | Connected mode omits the recommendation section; runtime confirmation pending |
| G-09 | Pass | URL builder targets `BD_selectKidsCafeResveCal.do` and the official public page exposes the facility calendar |
| G-10 | Pass | Regression test proves unverified date/slot fields are absent from the outbound URL |
| G-11 | Partial | Official public HTML retains facility in the login return URL and uses local form state for date/slot; real Kakao/mobile browser login pending |
| G-12 | Automated code evidence | Current customer UI has no automatic reservation-complete transition; return behavior pending |
| G-13 | Automated code evidence | Saved-item copy says `예약 후보` and warns that save is not completion; interaction confirmation pending |
| G-14 | Not verified | Browser visual automation unavailable; requires 390x844 review |
| G-15 | Pass | Removed customer-facing misleading terms from the main route |
| G-16 | Pass | Experimental adapter tests stop on unknown state and contain no automatic submit action |

## Official-flow evidence

The public facility calendar HTML confirms:

- facility calendar entry: `BD_selectKidsCafeResveCal.do`;
- login link returns to the same facility calendar with `q_fcltyId`;
- date selection populates `q_resveDe` in local form state;
- slot selection populates `q_tmeSn` and `q_reqstPosblCo` in local form state;
- application continues by POST to `BD_insertKidsCafeForm.do`;
- login return does not preserve the chosen date and slot.

See `SEOUL_FLOW_FEASIBILITY.md` for the product and runtime implications.

## Remaining blockers to alpha completion

1. Visual and interaction validation of G-01 through G-04, G-08, G-13, and G-14.
2. Exact-value Kakao OAuth restoration retest for G-07.
3. Real Seoul-login return test in Kakao in-app browser and a normal mobile browser for G-11.
4. Policy decision for continued closed-alpha use of the read-only UMPPA slot endpoint.

The alpha is not complete.
