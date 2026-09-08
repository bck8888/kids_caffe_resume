import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeSeoulFacility, normalizeUmppaCalendar, normalizeUmppaDetail } from "../src/normalize.mjs";

const fixture=(name)=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url),"utf8");

test("normalizes official facility fields without inventing absence",()=>{
  const value=normalizeSeoulFacility({FCLTY_ID:"T1",FCLTY_NM:"테스트",ATDRC_NM:"테스트구",X_CRDNT_VALUE:"127.1",Y_CRDNT_VALUE:"37.5",CLOSE_WEEK:"월요일"});
  assert.equal(value.sourceFacilityId,"T1"); assert.equal(value.longitude,127.1); assert.equal(value.assertions.regular_closure,"월요일"); assert.equal(value.assertions.age_eligibility,"");
});

test("extracts sourced detail knowledge deterministically",()=>{
  const value=normalizeUmppaDetail(fixture("detail.html"),"https://umppa.seoul.go.kr/example");
  assert.equal(value.title,"서울형 키즈카페 테스트점(별칭 놀이터)"); assert.equal(value.sessions.length,2);
  assert.deepEqual([...new Set(value.equipment.map((item)=>item.key))].sort(),["ball_pool","slide"]);
  assert.equal(value.careObserved,false); assert.equal(value.waitlistObserved,true);
  assert.ok(value.rules.some((rule)=>rule.type==="guardian")); assert.ok(value.features.some((feature)=>feature.type==="socks"));
});

test("keeps unavailable-without-reason ambiguous and expires observations",()=>{
  const observedAt="2026-09-06T00:00:00.000Z"; const value=normalizeUmppaCalendar(fixture("calendar.html"),2026,9,observedAt);
  assert.equal(value.days.length,3); assert.equal(value.closures.length,1); assert.equal(value.closures[0].type,"temporary_closure");
  assert.equal(value.days[1].reason,null); assert.equal(value.days[0].expiresAt,"2026-09-06T06:00:00.000Z");
});
