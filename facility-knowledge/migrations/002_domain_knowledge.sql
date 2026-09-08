CREATE TABLE facility_rules (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  rule_type TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  normalized_json TEXT NOT NULL DEFAULT '{}',
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  UNIQUE(facility_id, rule_type, rule_text, assertion_id)
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  session_kind TEXT NOT NULL DEFAULT 'normal',
  session_order INTEGER,
  start_time TEXT,
  end_time TEXT,
  days_text TEXT,
  capacity INTEGER,
  care_available TEXT NOT NULL DEFAULT 'not_observed',
  waitlist_available TEXT NOT NULL DEFAULT 'not_observed',
  source_text TEXT NOT NULL,
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, session_kind, start_time, end_time, source_text, assertion_id)
);

CREATE TABLE programs (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  program_type TEXT NOT NULL,
  name TEXT,
  schedule_text TEXT,
  care_metadata_json TEXT NOT NULL DEFAULT '{}',
  waitlist_metadata_json TEXT NOT NULL DEFAULT '{}',
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE closure_events (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  closure_date TEXT,
  effective_from TEXT,
  effective_to TEXT,
  closure_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  verification_state TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, closure_date, closure_type, reason, assertion_id)
);

CREATE TABLE facility_features (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  feature_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  normalized_value TEXT,
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, feature_type, source_text, assertion_id)
);

CREATE TABLE play_zones (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL,
  source_term TEXT NOT NULL,
  target_age_text TEXT,
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, name, source_term, assertion_id)
);

CREATE TABLE equipment (
  id INTEGER PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  canonical_name_ko TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE equipment_aliases (
  id INTEGER PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(equipment_id, normalized_alias, source_snapshot_id)
);

CREATE TABLE equipment_attributes (
  id INTEGER PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  source_snapshot_id INTEGER REFERENCES source_snapshots(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(equipment_id, attribute_key, attribute_value)
);

CREATE TABLE facility_equipment (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  play_zone_id INTEGER REFERENCES play_zones(id),
  source_term TEXT NOT NULL,
  target_age_text TEXT,
  assertion_id INTEGER NOT NULL REFERENCES facility_assertions(id),
  verification_state TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, equipment_id, source_term, assertion_id)
);

CREATE TABLE media_references (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  media_type TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'referenced_only',
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, public_url, source_snapshot_id)
);

CREATE TABLE availability_observations (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  session_id INTEGER REFERENCES sessions(id),
  observation_date TEXT NOT NULL,
  observed_state TEXT NOT NULL CHECK (observed_state IN ('available','unavailable','waitlist_only','unknown','not_observed')),
  observed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ambiguity_reason TEXT,
  source_snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  properties_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, observation_date, observed_at, source_snapshot_id)
);

CREATE INDEX facility_rules_type_idx ON facility_rules(facility_id, rule_type);
CREATE INDEX closure_events_date_idx ON closure_events(facility_id, closure_date);
CREATE INDEX facility_equipment_idx ON facility_equipment(facility_id, equipment_id);
CREATE INDEX availability_expiry_idx ON availability_observations(expires_at);
