# Codex Project Guidance

## Project

Seoul Kids Cafe MVP (`kids_caffe_resume`) is a mobile-first web service for finding Seoul public kids cafes, checking available reservation slots, and helping users move into the official Seoul reservation flow.

## Current product scope

- Keep the main experience focused on three cards:
  - Kakao-login based one-tap reservation assistant
  - Frequently used facilities, limited to 1-3 selected cafes
  - Three recommended cafes based on preferred playground equipment
- Keep map features on a separate page or external Kakao Map flow.
- Do not implement Seoul account credential storage, automatic Seoul login, automatic reservation submission, or app-side cancellation unless explicitly requested after legal/policy review.
- Final reservation confirmation should remain user-controlled on the official Seoul page.

## Data and integration boundaries

- Use Seoul Open API for official facility data.
- Use the public UMPPA reservation slot endpoint only as a read-only availability source.
- Treat UMPPA reservation slot usage as a policy risk until Seoul confirms production use permission.
- Store secret values only in `.env.local`; never commit real API keys.
- Keep `.env.example` limited to variable names and placeholder values.

## Engineering rules

- Keep recommendation and ontology logic modular so algorithms can be replaced without UI rewrites.
- Keep backend fetch/normalization logic separate from UI components.
- Prefer small, verifiable changes.
- Run validation before handing off:
  - `npm run check`
  - `npm run build`
- Preserve unrelated user changes in the worktree.

## UX rules

- Main screen must remain visually simple and high contrast.
- Support selecting 1, 2, or 3 favorite facilities; do not require exactly 3.
- For reservation assistance, when the user gives a desired time, show:
  - the slot containing that time
  - the next slot
  - ask which one the user wants to reserve
- Avoid making users repeat facility/date/time selection after login whenever technically possible.

## Handoff

Before continuing work, read `PROJECT_HANDOFF.md` for current decisions, known issues, and next tasks.
