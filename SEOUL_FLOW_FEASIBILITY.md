# Seoul reservation-flow feasibility

Last verified: 2026-09-02

## Decision

The target experience remains: preserve a user's facility, date, and slot through the Seoul-login boundary and help the user reach the final, user-controlled application step.

That target is **not achievable by URL handoff from an ordinary Kakao/mobile web app alone**. A separate, policy-approved runtime capable of assisting the official cross-origin page is required for the full reservation-assistant promise.

Until that runtime is proven, the connected web MVP must describe itself as a reservation-preparation assistant. It may remember the intent, show it clearly, and open the correct official facility calendar, but it must not claim to restore the official date/slot selection or operate the official page.

## Verified official flow

Public official page inspected:

```text
https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=SC240404&q_fcltyStle=
```

Observed behavior from the official public HTML:

1. `BD_selectKidsCafeResveCal.do` is the facility calendar and reservation entry page.
2. The page has a Seoul login link with a `returnUrl` back to the same facility calendar.
3. That login return URL preserves `q_fcltyId` and `q_fcltyStle`; it does not preserve the selected date or slot.
4. Choosing a date sets page-local hidden form values such as `q_resveDe`.
5. Choosing a slot sets page-local hidden form values such as `q_tmeSn` and `q_reqstPosblCo`.
6. The application action validates those hidden values and POSTs the form to `BD_insertKidsCafeForm.do`.
7. The public page explicitly tells users to log in before reservation and returns them to the facility calendar after login.

Relevant official form fields:

```text
q_fcltyId
q_year
q_month
q_resveDe
q_dayNo
q_tmeSn
q_reqstPosblCo
q_useSeCode
```

## Implications

### What the ordinary web MVP can do

- Preserve facility, date, desired time, and chosen slot in the Seoul Kids service.
- Read available slots from the existing read-only source, subject to policy approval.
- Open the correct official facility calendar using `q_fcltyId`.
- Keep a compact intent summary visible in the Seoul Kids service for manual confirmation.
- Explain that Seoul login may be required.
- Keep final submission user-controlled.

### What the ordinary web MVP cannot claim

- Detect the user's Seoul session before navigating to the official origin.
- Read the official page DOM after navigation.
- Close official-page popups.
- Select the official date or slot.
- Fill the official applicant form.
- Verify official completion merely from opening the page.

These restrictions follow from the cross-origin boundary and the official page's POST-based application flow.

## Runtime options for the full target

| Option | Kakao/mobile fit | Can assist official page | Product/policy status |
|---|---:|---:|---|
| Ordinary web/PWA | High | No | Safe fallback scope |
| Browser extension | Low on mobile | Potentially | Requires permission and policy review |
| Native app with controlled WebView | Medium | Potentially | Requires native build, technical proof, and policy review |
| Seoul-supported API or partnership | High | Yes, if provided | Preferred but externally dependent |

No runtime option is approved or implemented yet.

## Required real-device tests

- Kakao in-app browser: open official calendar and complete Seoul login.
- Verify the exact post-login URL and whether only the facility is retained.
- Normal mobile Safari/Chrome: repeat the same test.
- Confirm whether the official site opens a new browser context or stays in the same in-app context.
- Record the manual steps still required after login.
- Do not enter, capture, or store Seoul credentials in the project.

## Product gate

Do not expose the customer-facing label `Edge AI reservation assistant` until all of the following are true:

1. An allowed runtime is selected.
2. Official-page state observation works on the target mobile environment.
3. Date and slot continuation works after a real Seoul login.
4. Unknown official screens stop safely.
5. Final submission remains user-controlled.
6. Legal and policy review approves the integration method.
