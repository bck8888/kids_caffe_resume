# Facility knowledge coverage report

Generated from the local development database on 2026-09-06 (Asia/Seoul). Database: `.local/facility-knowledge.sqlite` (Git-ignored, approximately 95 MB). Collection month: `2026-09`.

## Source coverage

| Source | Distinct requests | Snapshot versions | Parsed requests | Coverage |
|---|---:|---:|---:|---:|
| Seoul Open API `tnFcltySttusInfo1011` | 1 | 1 | 1 | 137/137 facilities |
| Public UMPPA facility detail | 137 | 274 | 137 | 137/137 facilities |
| Public UMPPA facility calendar | 137 | 274 | 137 | 137/137 facilities |

Both connected retrieval passes completed with zero HTTP/parser target failures. The third run exercised resume behavior and skipped all previously successful public-page targets; assertion versions, availability versions, and unique equipment links remained unchanged (`26179`, `7920`, and `17` before and after).

Only unauthenticated public pages were requested. The Open API request URL is stored with `{API_KEY}` in place of the secret. No cookie, credential, applicant, guardian, child, reservation application, authenticated URL, or other personal data is collected.

## Facility field coverage

Coverage below means a positive source observation was parsed for that many of the 137 facilities. Every remainder is `not_observed`, not `confirmed_absent`.

| Field group | Facilities observed | Gap |
|---|---:|---:|
| District / address / coordinates / contact / operator / facility type | 137 | 0 |
| Opening hours | 136 | 1 |
| Fee | 133 | 4 |
| Payment | 121 | 16 |
| Age rule | 127 | 10 |
| Residency rule | 124 | 13 |
| Evidence rule | 124 | 13 |
| Child rule | 134 | 3 |
| Guardian rule | 137 | 0 |
| Group rule | 134 | 3 |
| Frequency rule | 128 | 9 |
| Duplicate-reservation rule | 74 | 63 |
| No-show rule | 125 | 12 |
| Normal session | 134 | 3 |
| Program metadata | 42 | 95 |
| Care metadata | 126 | 11 |
| Waitlist metadata | 1 | 136 |
| Explicit calendar closure reason | 132 | 5 |
| Play-zone term | 24 | 113 |
| Equipment term | 14 | 123 |
| Accessibility | 31 | 106 |
| Parking | 69 | 68 |
| Transit | 2 | 135 |
| Food rule/notice | 129 | 8 |
| Socks rule/notice | 122 | 15 |
| Safety notice | 135 | 2 |

## Equipment coverage

The public detail-page wording yielded 6 normalized terms, 17 unique facility/equipment/source-term links, and 14 facilities with any equipment observation.

| Normalized equipment | Facilities | Source terms observed |
|---|---:|---|
| 미끄럼틀 (`slide`) | 6 | 미끄럼틀, 슬라이드 |
| 트램펄린 (`trampoline`) | 4 | 트램펄린 |
| 물놀이 (`water_play`) | 3 | 물놀이 |
| 클라이밍 (`climbing`) | 2 | 클라이밍, 암벽 |
| 그물놀이 (`net_play`) | 1 | 그물놀이 |
| 모래놀이 (`sand_play`) | 1 | 모래놀이 |

This is not enough coverage to enable connected-mode equipment recommendations. Images are referenced but not OCR-processed, and linked notices/documents/directions are not crawled, so equipment, transit, accessibility, and some rule coverage remain intentionally sparse.

## Stored knowledge and temporal boundary

The database contains 137 official display-name aliases, 26,179 assertion versions, 8,767 distinct classified rule records, 1,023 distinct session records, 168 distinct program/service-metadata records, 33 distinct play-zone observations, 1,869 distinct dated closure records, 1,325 distinct feature observations, and 873 distinct public media references.

Calendar collection produced 7,920 observation versions across two explicit retrieval passes, representing 3,960 distinct facility/date/state records. These are expiring observations with six-hour TTLs, not durable facility facts. `예약불가` without a source-stated reason remains ambiguous; the subsystem never converts it to sold out, closed, or absent.

## Verification

- `npm run test:knowledge`: 4/4 passed.
- `npm test`: 33/33 existing tests passed (existing module-type performance warnings only).
- `npm run check`: passed.
- `npm run build`: passed (Next.js 16.3.3 production build).
- `git diff --check`: passed.
- No commit or push performed. `USER_FLOW.md` and the current UI were not modified.
