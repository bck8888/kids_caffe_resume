# 아이랑 서울 mobile fixture review

The primary page now presents the deterministic fixture as a consumer-facing, three-step journey for a tired parent: reservation conditions, minimum family information, then final review and bounded authorization. It still uses fixed facilities, generated availability fixtures, the in-memory execution lock, and `offline_fixture_submit_v1`; it never opens or submits the live Seoul form, and no model is loaded.

## Install and run

```bash
npm install
npm run dev
```

Open **http://localhost:3000/**. For a production-mode check, run `npm run build && npm run start` and open the same URL. The prior broad facility discovery UI is isolated at **http://localhost:3000/explore**.

## Review checklist

Use a 390 x 844 mobile viewport. Confirm only one decision group is visible at a time, the three-step progress state and back/next controls are clear, and internal residence codes never appear. Facility and time priorities must read as `먼저` and `다음`; the authorization control appears as the only sticky primary CTA and only on step 3.

The customer-facing product name is **아이랑 서울**. The quiet `연습 모드` notice stays visible without becoming the page headline. Fixture scenario selection, fixed versions, safe trace, and connected-disabled diagnostics stay inside the collapsed **개발·테스트 정보** panel.

For each scenario, check the candidate order and fixed-code status log; the log must never repeat the child or residence values entered above.

- `success`: F1/T1 wins; lock, form fill, one fixture dispatch, completion, and reservation-list verification pass.
- `all_unavailable`: no winner, lock, form write, or submit.
- `holiday`: the result remains an explicit holiday, not sold out.
- `ambiguous_unavailable`: the result is `availability_ambiguous`, not sold out or holiday.
- `popup_unknown`: stops with `unknown_review_form`; zero field writes and zero submit.
- `validation_error`: stops with `pending_validation_errors`; zero field writes and zero submit.
- `post_submit_ambiguity`: one fixture submit is recorded, status is `확인 필요`, and there is no automatic retry.
- `double_click_replay`: two dispatch calls produce one fixture submit and one blocked replay.

The main button must say **이 조건으로 1회 예약 시도** and stay disabled until all three displayed agreements are checked. It authorizes one fixture attempt for the reviewed binding, with no fallback after a dispatch and no automatic retry after an ambiguous result. There is no connected-submit customer control.

## Theme and accessibility contract

- Follow `prefers-color-scheme` while the preference is `기기 설정`; offer explicit `라이트` and `나이트` states through the labeled header toggle.
- Persist only the non-personal theme preference in `localStorage` under `irang-seoul-theme`; `system` removes the stored override.
- Set native `color-scheme` for explicit themes, maintain high-contrast tokens, use at least 44 px touch targets, show `:focus-visible` outlines, and disable non-essential motion for `prefers-reduced-motion`.

## Result behavior

- Success: explain that the fixture completed and that no real reservation happened.
- Unavailable: suggest changing the time or second facility.
- Holiday: identify the selected date as a declared closure and suggest another date.
- Confirmation required: never call the reservation complete or retry; direct the user to the official reservation list in a future connected product.
- Unknown screen or validation issue: say the attempt stopped safely and leave technical reason codes in the development panel.

## 390 x 844 Orca browser review (2026-09-07)

The production build was served locally and loaded only from `http://localhost:3104`. An Orca embedded-browser, same-origin review frame reported `innerWidth=390`, `innerHeight=844`, and `scrollWidth=390` in both themes.

- Light: explicit `data-theme=light`, `color-scheme=light`, computed page background `rgb(247, 245, 239)`, text `rgb(36, 37, 31)`. Visual inspection showed the `아이랑 서울` brand, quiet practice banner, plain-language progress, and a clean high-contrast review page.
- Night: explicit `data-theme=dark`, `color-scheme=dark`, computed page background `rgb(23, 25, 19)`, text `rgb(241, 242, 233)`. Visual inspection showed all header, progress, heading, and practice-label content remaining legible without light-theme surfaces leaking through.
- Interaction: step 2 showed Korean `서초구` / `서초동` controls and no internal codes; smallest measured control was 44 px. Step 3 showed one sticky authorization region, its bottom aligned to 844 px, a 54 px CTA, no technical jargon, and the development panel closed.
- Network/privacy: the review frame loaded local app assets only; customer result copy and deterministic tests exclude child values, residence codes, fixed facility IDs, F/T shorthand, and protocol reason codes.

This is fixture and presentation evidence, not a real-device, authenticated, policy, connected-submit, or production reservation verification.

## Validation

```bash
npm test
npm run test:knowledge
npm run check
npm run build
git diff --check
```

This is local fixture evidence only. It is not authenticated staging, connected-submit, real-device, policy approval, pilot, or production evidence.
