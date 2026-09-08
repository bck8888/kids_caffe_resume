# Facility knowledge subsystem

SQLite is the authoritative, local, non-personal facility-knowledge store. It is separate from the current UI and reservation action flow. No vector or graph service is required; a future vector index may only be a disposable projection rebuilt from approved SQLite rows and their provenance.

## Commands

```bash
npm run knowledge:migrate
npm run knowledge:collect -- --month 2026-09
npm run knowledge:collect -- --month 2026-09 --refresh
npm run knowledge:coverage
npm run test:knowledge
```

The default database is `.local/facility-knowledge.sqlite` and is ignored by Git. `FACILITY_KNOWLEDGE_DB_PATH` can override the path. Collection loads `SEOUL_OPEN_API_KEY` through the project's existing Next environment loader (`@next/env`); commands never log the key and persist a redacted Open API URL. UMPPA collection is restricted to unauthenticated public facility detail and calendar pages, uses at least 250 ms between requests, retries conservatively, and records resumable target status. A retry skips already successful targets; pass `--refresh` to deliberately retrieve them again.

## Schema and semantics

- `schema_migrations` versions additive SQL migrations.
- `sources`, `source_snapshots`, `collection_runs`, and `collection_targets` preserve source authority, public URL, raw public body and SHA-256, retrieval/known/effective times, parser version, parse state, retry state, and policy status.
- `facilities`, `facility_aliases`, `contact_channels`, and `official_urls` hold stable identifiers and base facts from the official Seoul Open API and public UMPPA pages.
- `facility_assertions` is the append-only provenance ledger. Changed values supersede earlier assertions without rewriting history; `assertion_conflicts` can record unresolved cross-source conflicts.
- `facility_rules`, `sessions`, `programs`, `closure_events`, and `facility_features` are queryable projections for age/residency/evidence, child/guardian/group/frequency/duplicate/no-show rules, normal/program/care/waitlist metadata, explicit closure reasons, accessibility/parking/transit/food/socks/safety, fees, and payment observations.
- `play_zones`, `equipment`, `equipment_aliases`, `equipment_attributes`, and `facility_equipment` preserve normalized equipment plus the exact observed source term, attributes, target-age text, and assertion provenance.
- `availability_observations` is never a durable facility fact. Calendar states carry observation and six-hour expiry timestamps. An unavailable or empty-success response without an explicit reason remains ambiguous.
- Every table has `properties_json` or normalized JSON columns for additive source-specific fields that do not yet justify a migration.

Absence from a page means `not_observed`, never `confirmed_absent`. The collector inserts only positive observations; the coverage report expresses missing extraction as gaps. No credentials, cookies, authenticated pages, applicants, children, contact profiles, exact birth data, or other personal data belong in this database.

Migration checksums are verified every time a command opens the schema. Add a new numbered migration; never edit one that has already been applied to a development database.

## Current extraction limits

HTML extraction is deliberately conservative and provenance-first. Structured text found on facility pages is classified by source wording; it is not treated as legal interpretation or a globally applicable rule. Directions pages, notices, linked documents, image OCR, authenticated form variants, current slot capacity, and program/care detail endpoints are not crawled. Re-run collection after adding a parser migration/version rather than destructively rewriting prior evidence.
