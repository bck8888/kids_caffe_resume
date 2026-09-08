import { sha256 } from "./normalize.mjs";
import { assertNoSensitiveKeys } from "../../lib/privacy/key-policy.mjs";

const json = (value) => JSON.stringify(value ?? {});

export function ensureSource(db, source) {
  assertNoSensitiveKeys(source);
  db.prepare(`INSERT INTO sources(source_key,name,source_type,authority,base_url,policy_status,properties_json,created_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET name=excluded.name, base_url=excluded.base_url, properties_json=excluded.properties_json`)
    .run(source.key, source.name, source.type, source.authority, source.baseUrl, source.policyStatus, json(source.properties), new Date().toISOString());
  return db.prepare("SELECT id FROM sources WHERE source_key=?").get(source.key).id;
}

export function saveSnapshot(db, snapshot) {
  assertNoSensitiveKeys(snapshot);
  db.prepare(`INSERT INTO source_snapshots(source_id,collection_run_id,request_key,public_url,media_type,http_status,content_sha256,response_body,retrieved_at,known_at,parser_version,verification_state,parse_status,error_text,properties_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,request_key,content_sha256) DO UPDATE SET collection_run_id=excluded.collection_run_id, retrieved_at=excluded.retrieved_at, parse_status=excluded.parse_status, error_text=excluded.error_text`)
    .run(snapshot.sourceId, snapshot.runId, snapshot.requestKey, snapshot.publicUrl, snapshot.mediaType, snapshot.httpStatus, snapshot.hash, snapshot.body, snapshot.retrievedAt, snapshot.knownAt, snapshot.parserVersion, snapshot.verificationState, snapshot.parseStatus ?? "pending", snapshot.errorText ?? null, json(snapshot.properties));
  return db.prepare("SELECT id FROM source_snapshots WHERE source_id=? AND request_key=? AND content_sha256=?").get(snapshot.sourceId, snapshot.requestKey, snapshot.hash).id;
}

export function upsertFacility(db, value, snapshotId, observedAt) {
  assertNoSensitiveKeys(value);
  db.prepare(`INSERT INTO facilities(source_facility_id,canonical_name,district_code,district_name,institution_code,institution_name,postal_code,base_address,detail_address,latitude,longitude,contact_text,facility_type_code,facility_type_name,operator_name,founded_on,official_detail_url,official_calendar_url,status,first_observed_at,last_observed_at,source_snapshot_id,properties_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'unknown',?,?,?,?)
    ON CONFLICT(source_facility_id) DO UPDATE SET canonical_name=excluded.canonical_name,district_code=excluded.district_code,district_name=excluded.district_name,institution_code=excluded.institution_code,institution_name=excluded.institution_name,postal_code=excluded.postal_code,base_address=excluded.base_address,detail_address=excluded.detail_address,latitude=excluded.latitude,longitude=excluded.longitude,contact_text=excluded.contact_text,facility_type_code=excluded.facility_type_code,facility_type_name=excluded.facility_type_name,operator_name=excluded.operator_name,founded_on=excluded.founded_on,official_detail_url=excluded.official_detail_url,official_calendar_url=excluded.official_calendar_url,last_observed_at=excluded.last_observed_at,source_snapshot_id=excluded.source_snapshot_id,properties_json=excluded.properties_json`)
    .run(value.sourceFacilityId,value.canonicalName,value.districtCode||null,value.districtName||null,value.institutionCode||null,value.institutionName||null,value.postalCode||null,value.baseAddress||null,value.detailAddress||null,value.latitude??null,value.longitude??null,value.contactText||null,value.facilityTypeCode||null,value.facilityTypeName||null,value.operatorName||null,value.foundedOn||null,value.officialDetailUrl,value.officialCalendarUrl,observedAt,observedAt,snapshotId,json(value.properties));
  const facilityId = db.prepare("SELECT id FROM facilities WHERE source_facility_id=?").get(value.sourceFacilityId).id;
  for (const [type, url] of [["detail",value.officialDetailUrl],["calendar",value.officialCalendarUrl]]) db.prepare("INSERT OR IGNORE INTO official_urls(facility_id,url_type,url,source_snapshot_id,properties_json) VALUES(?,?,?,?, '{}')").run(facilityId,type,url,snapshotId);
  if (value.contactText) for (const phone of value.contactText.split(/[,/]/).map((part) => part.trim()).filter(Boolean)) db.prepare("INSERT OR IGNORE INTO contact_channels(facility_id,channel_type,value,source_snapshot_id,properties_json) VALUES(?,'phone',?,?,'{}')").run(facilityId,phone,snapshotId);
  return facilityId;
}

export function addAssertion(db, { facilityId, predicate, value, snapshotId, observedAt, parserVersion, verificationState="confirmed", effectiveFrom=null, effectiveTo=null, properties={} }) {
  assertNoSensitiveKeys({ [predicate]: value, properties });
  if (value === "" || value == null || (Array.isArray(value) && value.length === 0)) return null;
  const valueJson = json(value); const valueHash = sha256(valueJson);
  const existing = db.prepare("SELECT id FROM facility_assertions WHERE facility_id=? AND predicate=? AND value_hash=? AND source_snapshot_id=?").get(facilityId,predicate,valueHash,snapshotId);
  if (existing) return existing.id;
  const previous = db.prepare("SELECT id,value_hash FROM facility_assertions WHERE facility_id=? AND predicate=? AND superseded_at IS NULL ORDER BY known_at DESC,id DESC LIMIT 1").get(facilityId,predicate);
  const result = db.prepare(`INSERT INTO facility_assertions(facility_id,predicate,value_json,value_hash,source_snapshot_id,observed_at,known_at,effective_from,effective_to,parser_version,verification_state,previous_assertion_id,properties_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(facilityId,predicate,valueJson,valueHash,snapshotId,observedAt,observedAt,effectiveFrom,effectiveTo,parserVersion,verificationState,previous?.id??null,json(properties));
  const id = Number(result.lastInsertRowid);
  if (previous && previous.value_hash !== valueHash) db.prepare("UPDATE facility_assertions SET superseded_at=?, superseded_by_assertion_id=? WHERE id=?").run(observedAt,id,previous.id);
  return id;
}

export function saveDetailKnowledge(db, facilityId, detail, snapshotId, observedAt, parserVersion) {
  if (detail.title) db.prepare("INSERT OR IGNORE INTO facility_aliases(facility_id,alias,alias_type,source_term,source_snapshot_id,properties_json) VALUES(?,?,'official_display_name',?,?, '{}')").run(facilityId,detail.title,detail.title,snapshotId);
  for (const [name, text] of Object.entries(detail.sections)) addAssertion(db,{facilityId,predicate:`detail.${name}`,value:text,snapshotId,observedAt,parserVersion});
  for (const rule of detail.rules) {
    const id=addAssertion(db,{facilityId,predicate:`rule.${rule.type}`,value:rule.sourceText,snapshotId,observedAt,parserVersion});
    if(id) db.prepare("INSERT OR IGNORE INTO facility_rules(facility_id,rule_type,rule_text,assertion_id) VALUES(?,?,?,?)").run(facilityId,rule.type,rule.sourceText,id);
  }
  detail.sessions.forEach((session,index)=>{ const id=addAssertion(db,{facilityId,predicate:"session.normal",value:session,snapshotId,observedAt,parserVersion}); if(id) db.prepare("INSERT OR IGNORE INTO sessions(facility_id,session_order,start_time,end_time,care_available,waitlist_available,source_text,assertion_id) VALUES(?,?,?,?,?,?,?,?)").run(facilityId,index+1,session.startTime,session.endTime,detail.careObserved?'observed_in_detail_text':'not_observed',detail.waitlistObserved?'observed_in_detail_text':'not_observed',session.sourceText,id); });
  for (const feature of detail.features) { const id=addAssertion(db,{facilityId,predicate:`feature.${feature.type}`,value:feature.sourceText,snapshotId,observedAt,parserVersion}); if(id) db.prepare("INSERT OR IGNORE INTO facility_features(facility_id,feature_type,source_text,assertion_id) VALUES(?,?,?,?)").run(facilityId,feature.type,feature.sourceText,id); }
  for (const item of detail.equipment) {
    db.prepare("INSERT INTO equipment(canonical_key,canonical_name_ko,properties_json) VALUES(?,?,?) ON CONFLICT(canonical_key) DO UPDATE SET canonical_name_ko=excluded.canonical_name_ko").run(item.key,item.name,json({optionalVectorProjection:"rebuildable"}));
    const equipmentId=db.prepare("SELECT id FROM equipment WHERE canonical_key=?").get(item.key).id;
    db.prepare("INSERT OR IGNORE INTO equipment_aliases(equipment_id,alias,normalized_alias,source_snapshot_id,properties_json) VALUES(?,?,?,?, '{}')").run(equipmentId,item.sourceTerm,item.sourceTerm.replace(/\s/g,""),snapshotId);
    for(const attribute of item.attributes) db.prepare("INSERT OR IGNORE INTO equipment_attributes(equipment_id,attribute_key,attribute_value,source_snapshot_id,properties_json) VALUES(?,'play_mode',?,?, '{}')").run(equipmentId,attribute,snapshotId);
    const id=addAssertion(db,{facilityId,predicate:`equipment.${item.key}`,value:{sourceTerm:item.sourceTerm,targetAgeText:item.targetAgeText},snapshotId,observedAt,parserVersion});
    if(id) db.prepare("INSERT OR IGNORE INTO facility_equipment(facility_id,equipment_id,source_term,target_age_text,assertion_id,verification_state,properties_json) VALUES(?,?,?,?,?,'confirmed','{}')").run(facilityId,equipmentId,item.sourceTerm,item.targetAgeText||null,id);
  }
  for(const zone of detail.playZones) { const id=addAssertion(db,{facilityId,predicate:"play_zone",value:zone,snapshotId,observedAt,parserVersion}); if(id) db.prepare("INSERT OR IGNORE INTO play_zones(facility_id,name,source_term,target_age_text,assertion_id,properties_json) VALUES(?,?,?,?,?,'{}')").run(facilityId,zone.name,zone.sourceTerm,zone.targetAgeText||null,id); }
  for(const program of detail.programs) { const id=addAssertion(db,{facilityId,predicate:"program.metadata",value:program,snapshotId,observedAt,parserVersion}); if(id) db.prepare("INSERT OR IGNORE INTO programs(facility_id,program_type,name,schedule_text,care_metadata_json,waitlist_metadata_json,assertion_id,properties_json) VALUES(?,?,?,?,?,?,?,'{}')").run(facilityId,program.type,program.name,program.scheduleText||null,json({observedInDetailText:detail.careObserved}),json({observedInDetailText:detail.waitlistObserved}),id); }
  if(detail.careObserved||detail.waitlistObserved) { const metadata={careObserved:detail.careObserved,waitlistObserved:detail.waitlistObserved}; const id=addAssertion(db,{facilityId,predicate:"service.metadata",value:metadata,snapshotId,observedAt,parserVersion}); if(id) db.prepare("INSERT OR IGNORE INTO programs(facility_id,program_type,name,schedule_text,care_metadata_json,waitlist_metadata_json,assertion_id,properties_json) VALUES(?,'service_metadata',NULL,NULL,?,?,?,'{}')").run(facilityId,json({observedInDetailText:detail.careObserved}),json({observedInDetailText:detail.waitlistObserved}),id); }
  for(const media of detail.images) db.prepare("INSERT OR IGNORE INTO media_references(facility_id,media_type,public_url,alt_text,source_snapshot_id,properties_json) VALUES(?,'image',?,?,?,'{}')").run(facilityId,media.url,media.alt||null,snapshotId);
}

export function saveCalendarKnowledge(db, facilityId, calendar, snapshotId, observedAt, parserVersion) {
  for(const closure of calendar.closures) { const id=addAssertion(db,{facilityId,predicate:`closure.${closure.date}`,value:{type:closure.type,reason:closure.reason},snapshotId,observedAt,parserVersion,effectiveFrom:closure.date,effectiveTo:closure.date}); if(id) db.prepare("INSERT OR IGNORE INTO closure_events(facility_id,closure_date,effective_from,effective_to,closure_type,reason,assertion_id,verification_state,properties_json) VALUES(?,?,?,?,?,?,?,'confirmed','{}')").run(facilityId,closure.date,closure.date,closure.date,closure.type,closure.reason,id); }
  for(const day of calendar.days) db.prepare("INSERT OR IGNORE INTO availability_observations(facility_id,observation_date,observed_state,observed_at,expires_at,ambiguity_reason,source_snapshot_id,properties_json) VALUES(?,?,?,?,?,?,?,'{}')").run(facilityId,day.date,day.state,day.observedAt,day.expiresAt,day.state==='unavailable'&&!day.reason?'Calendar says unavailable but supplies no reason; do not infer sold out or closure.':null,snapshotId);
}
