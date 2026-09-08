PRAGMA foreign_keys = ON;

CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  authority TEXT NOT NULL,
  base_url TEXT NOT NULL,
  policy_status TEXT NOT NULL DEFAULT 'approved_public',
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE collection_runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  parser_version TEXT NOT NULL,
  requested_month TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE source_snapshots (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  collection_run_id INTEGER REFERENCES collection_runs(id),
  request_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  content_sha256 TEXT NOT NULL,
  response_body BLOB,
  retrieved_at TEXT NOT NULL,
  known_at TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  parser_version TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK (verification_state IN ('confirmed','inferred','conflicting','not_observed')),
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending','parsed','failed')),
  error_text TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_id, request_key, content_sha256)
);

CREATE TABLE facilities (
  id INTEGER PRIMARY KEY,
  source_facility_id TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  district_code TEXT,
  district_name TEXT,
  institution_code TEXT,
  institution_name TEXT,
  postal_code TEXT,
  base_address TEXT,
  detail_address TEXT,
  latitude REAL,
  longitude REAL,
  contact_text TEXT,
  facility_type_code TEXT,
  facility_type_name TEXT,
  operator_name TEXT,
  founded_on TEXT,
  official_detail_url TEXT,
  official_calendar_url TEXT,
  status TEXT NOT NULL DEFAULT 'not_observed' CHECK (status IN ('active','regularly_closed','temporarily_closed','unknown','not_observed')),
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE facility_aliases (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  source_term TEXT,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  verification_state TEXT NOT NULL DEFAULT 'confirmed',
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, alias, alias_type)
);

CREATE TABLE contact_channels (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  channel_type TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  verification_state TEXT NOT NULL DEFAULT 'confirmed',
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, channel_type, value)
);

CREATE TABLE official_urls (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  url_type TEXT NOT NULL,
  url TEXT NOT NULL,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  verification_state TEXT NOT NULL DEFAULT 'confirmed',
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, url_type, url)
);

CREATE TABLE facility_assertions (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  predicate TEXT NOT NULL,
  value_json TEXT NOT NULL,
  value_hash TEXT NOT NULL,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  observed_at TEXT NOT NULL,
  known_at TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  parser_version TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK (verification_state IN ('confirmed','inferred','conflicting','not_observed')),
  previous_assertion_id INTEGER REFERENCES facility_assertions(id),
  superseded_at TEXT,
  superseded_by_assertion_id INTEGER REFERENCES facility_assertions(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, predicate, value_hash, source_snapshot_id)
);

CREATE TABLE assertion_conflicts (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  predicate TEXT NOT NULL,
  left_assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  right_assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  conflict_reason TEXT NOT NULL,
  resolution_state TEXT NOT NULL DEFAULT 'open',
  resolved_assertion_id INTEGER REFERENCES facility_assertions(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE collection_targets (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  target_key TEXT NOT NULL,
  facility_source_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_snapshot_id INTEGER REFERENCES source_snapshots(id),
  error_text TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_id, target_key)
);

CREATE INDEX facility_assertions_current_idx ON facility_assertions(facility_id, predicate) WHERE superseded_at IS NULL;
CREATE INDEX source_snapshots_request_idx ON source_snapshots(source_id, request_key, retrieved_at DESC);
