import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { migrate, openDatabase } from "../src/db.mjs";
import { addAssertion, ensureSource, saveSnapshot, upsertFacility } from "../src/repository.mjs";

test("migrations are idempotent and changed assertions supersede",()=>{
  const db=openDatabase(join(mkdtempSync(join(tmpdir(),"facility-knowledge-")),"test.sqlite")); migrate(db); migrate(db);
  const sourceId=ensureSource(db,{key:"fixture",name:"Fixture",type:"fixture",authority:"test",baseUrl:"https://example.test",policyStatus:"test",properties:{}});
  const snapshotId=saveSnapshot(db,{sourceId,runId:null,requestKey:"one",publicUrl:"https://example.test/one",mediaType:"application/json",httpStatus:200,hash:"abc",body:"{}",retrievedAt:"2026-09-06T00:00:00Z",knownAt:"2026-09-06T00:00:00Z",parserVersion:"test",verificationState:"confirmed",parseStatus:"parsed"});
  const facilityId=upsertFacility(db,{sourceFacilityId:"T1",canonicalName:"테스트",officialDetailUrl:"https://example.test/d",officialCalendarUrl:"https://example.test/c",properties:{}},snapshotId,"2026-09-06T00:00:00Z");
  const first=addAssertion(db,{facilityId,predicate:"rule.age",value:"4-8",snapshotId,observedAt:"2026-09-06T00:00:00Z",parserVersion:"test"});
  const second=addAssertion(db,{facilityId,predicate:"rule.age",value:"5-9",snapshotId,observedAt:"2026-09-07T00:00:00Z",parserVersion:"test"});
  assert.notEqual(first,second); const previous=db.prepare("SELECT superseded_by_assertion_id FROM facility_assertions WHERE id=?").get(first); assert.equal(previous.superseded_by_assertion_id,second);
  assert.equal(db.prepare("SELECT count(*) n FROM schema_migrations").get().n,3); db.close();
});

test("facility knowledge repository rejects reservation-personal and auth-shaped fields",()=>{
  const db=openDatabase(join(mkdtempSync(join(tmpdir(),"facility-privacy-")),"test.sqlite")); migrate(db);
  const sourceId=ensureSource(db,{key:"fixture",name:"Fixture",type:"fixture",authority:"test",baseUrl:"https://example.test",policyStatus:"test",properties:{}});
  const snapshotId=saveSnapshot(db,{sourceId,runId:null,requestKey:"one",publicUrl:"https://example.test/one",mediaType:"application/json",httpStatus:200,hash:"abc",body:"{}",retrievedAt:"2026-09-06T00:00:00Z",knownAt:"2026-09-06T00:00:00Z",parserVersion:"test",verificationState:"confirmed",parseStatus:"parsed"});
  assert.throws(()=>upsertFacility(db,{sourceFacilityId:"T1",canonicalName:"테스트",officialDetailUrl:"https://example.test/d",officialCalendarUrl:"https://example.test/c",properties:{child_name:"개인정보"}},snapshotId,"2026-09-06T00:00:00Z"),/Sensitive key/);
  assert.equal(db.prepare("SELECT count(*) n FROM facilities").get().n,0);
  assert.throws(()=>addAssertion(db,{facilityId:1,predicate:"debug",value:{nested:{session_token:"secret"}},snapshotId,observedAt:"2026-09-06T00:00:00Z",parserVersion:"test"}),/Sensitive key/);
  assert.throws(()=>addAssertion(db,{facilityId:1,predicate:"reservation.child_name",value:"개인정보",snapshotId,observedAt:"2026-09-06T00:00:00Z",parserVersion:"test"}),/Sensitive key/);
  db.close();
});
