export function coverageReport(db) {
  const scalar=(sql,...params)=>Number(Object.values(db.prepare(sql).get(...params))[0]);
  const rows=(sql)=>db.prepare(sql).all();
  const facilities=scalar("SELECT count(*) AS n FROM facilities");
  const bySource=rows(`SELECT s.source_key, count(DISTINCT ss.request_key) requests, count(ss.id) snapshot_versions, count(DISTINCT CASE WHEN ss.parse_status='parsed' THEN ss.request_key END) parsed_requests
    FROM sources s LEFT JOIN source_snapshots ss ON ss.source_id=s.id GROUP BY s.id ORDER BY s.source_key`);
  const equipment=scalar("SELECT count(*) n FROM equipment");
  const facilityEquipment=scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,equipment_id,source_term FROM facility_equipment)");
  const equipmentFacilities=scalar("SELECT count(DISTINCT facility_id) n FROM facility_equipment");
  const facilityCountFor=(table,where="1=1")=>scalar(`SELECT count(DISTINCT facility_id) n FROM ${table} WHERE ${where}`);
  const fieldCoverage={
    district:scalar("SELECT count(*) n FROM facilities WHERE district_name IS NOT NULL AND district_name<>''"),
    address:scalar("SELECT count(*) n FROM facilities WHERE base_address IS NOT NULL AND base_address<>''"),
    coordinates:scalar("SELECT count(*) n FROM facilities WHERE latitude IS NOT NULL AND longitude IS NOT NULL"),
    contact:scalar("SELECT count(*) n FROM facilities WHERE contact_text IS NOT NULL AND contact_text<>''"),
    operator:scalar("SELECT count(*) n FROM facilities WHERE operator_name IS NOT NULL AND operator_name<>''"),
    facilityType:scalar("SELECT count(*) n FROM facilities WHERE facility_type_name IS NOT NULL AND facility_type_name<>''"),
    openingHours:scalar("SELECT count(DISTINCT facility_id) n FROM facility_assertions WHERE predicate='detail.hours' AND value_json<>'\"\"'"),
    fee:facilityCountFor("facility_rules","rule_type='fee'"), payment:facilityCountFor("facility_rules","rule_type='payment'"),
    age:facilityCountFor("facility_rules","rule_type='age'"), residency:facilityCountFor("facility_rules","rule_type='residency'"), evidence:facilityCountFor("facility_rules","rule_type='evidence'"),
    childRules:facilityCountFor("facility_rules","rule_type='child'"), guardianRules:facilityCountFor("facility_rules","rule_type='guardian'"), groupRules:facilityCountFor("facility_rules","rule_type='group'"),
    frequencyRules:facilityCountFor("facility_rules","rule_type='frequency'"), duplicateRules:facilityCountFor("facility_rules","rule_type='duplicate'"), noShowRules:facilityCountFor("facility_rules","rule_type='no_show'"),
    normalSessions:facilityCountFor("sessions"), programMetadata:facilityCountFor("programs","program_type='program'"), careMetadata:facilityCountFor("programs","json_extract(care_metadata_json,'$.observedInDetailText')=1"), waitlistMetadata:facilityCountFor("programs","json_extract(waitlist_metadata_json,'$.observedInDetailText')=1"),
    explicitClosures:facilityCountFor("closure_events"), playZones:facilityCountFor("play_zones"), equipment:equipmentFacilities,
    accessibility:facilityCountFor("facility_features","feature_type='accessibility'"), parking:facilityCountFor("facility_features","feature_type='parking'"), transit:facilityCountFor("facility_features","feature_type='transit'"), food:facilityCountFor("facility_features","feature_type='food'"), socks:facilityCountFor("facility_features","feature_type='socks'"), safetyNotices:facilityCountFor("facility_features","feature_type='safety_notice'")
  };
  const gaps={
    noDetailSnapshot:scalar(`SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM collection_targets t JOIN sources s ON s.id=t.source_id WHERE s.source_key='umppa-public-detail' AND t.facility_source_id=f.source_facility_id AND t.status='succeeded')`),
    noCalendarSnapshot:scalar(`SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM collection_targets t JOIN sources s ON s.id=t.source_id WHERE s.source_key='umppa-public-calendar' AND t.facility_source_id=f.source_facility_id AND t.status='succeeded')`),
    noEquipmentObserved:scalar("SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM facility_equipment fe WHERE fe.facility_id=f.id)"),
    noStructuredSession:scalar("SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM sessions x WHERE x.facility_id=f.id)"),
    noExplicitClosureReason:scalar("SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM closure_events x WHERE x.facility_id=f.id)"),
    noParkingObservation:scalar("SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM facility_features x WHERE x.facility_id=f.id AND x.feature_type='parking')"),
    noAccessibilityObservation:scalar("SELECT count(*) n FROM facilities f WHERE NOT EXISTS (SELECT 1 FROM facility_features x WHERE x.facility_id=f.id AND x.feature_type='accessibility')")
  };
  return {generatedAt:new Date().toISOString(),facilities,sources:bySource,fieldCoverage,equipment:{canonicalTerms:equipment,facilityLinks:facilityEquipment,facilitiesWithObservedEquipment:equipmentFacilities,terms:rows("SELECT e.canonical_key,e.canonical_name_ko,count(DISTINCT fe.facility_id || ':' || fe.source_term) links,count(DISTINCT fe.facility_id) facilities,group_concat(DISTINCT fe.source_term) source_terms FROM equipment e LEFT JOIN facility_equipment fe ON fe.equipment_id=e.id GROUP BY e.id ORDER BY facilities DESC,e.canonical_key")},knowledge:{aliases:scalar("SELECT count(*) n FROM facility_aliases"),assertionVersions:scalar("SELECT count(*) n FROM facility_assertions"),distinctRules:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,rule_type,rule_text FROM facility_rules)"),distinctSessions:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,session_kind,start_time,end_time,source_text FROM sessions)"),distinctProgramsAndServiceMetadata:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,program_type,coalesce(name,''),coalesce(schedule_text,''),care_metadata_json,waitlist_metadata_json FROM programs)"),distinctPlayZones:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,name,source_term FROM play_zones)"),distinctClosures:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,closure_date,closure_type,reason FROM closure_events)"),distinctFeatures:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,feature_type,source_text FROM facility_features)"),distinctMediaReferences:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,public_url FROM media_references)"),availabilityObservationVersions:scalar("SELECT count(*) n FROM availability_observations"),distinctObservedCalendarStates:scalar("SELECT count(*) n FROM (SELECT DISTINCT facility_id,observation_date,observed_state,coalesce(ambiguity_reason,'') FROM availability_observations)")},gaps,semantics:{absence:"not_observed",emptyAvailability:"ambiguous unless source states a reason",availabilityTtlHours:6,sqliteAuthoritative:true,vectorIndex:"optional rebuildable projection only"}};
}
