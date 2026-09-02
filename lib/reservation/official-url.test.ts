import test from "node:test";
import assert from "node:assert/strict";
import { buildOfficialCalendarUrl } from "./official-url.ts";

test("공식 시설 달력 진입 URL만 만든다",()=>{
  const url=new URL(buildOfficialCalendarUrl("SC240404","2026-09-06"));
  assert.equal(url.pathname,"/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do");
  assert.equal(url.searchParams.get("q_fcltyId"),"SC240404");
  assert.equal(url.searchParams.get("q_year"),"2026");
  assert.equal(url.searchParams.get("q_month"),"09");
});

test("검증되지 않은 날짜와 회차 선택을 공식 URL에 포함하지 않는다",()=>{
  const url=new URL(buildOfficialCalendarUrl("SC240404","2026-09-06"));
  assert.equal(url.searchParams.has("q_resveDe"),false);
  assert.equal(url.searchParams.has("q_tmeSn"),false);
  assert.equal(url.searchParams.has("q_resveTmeSn"),false);
  assert.equal(url.searchParams.has("q_reqstPosblCo"),false);
});

test("시설 ID와 날짜가 없으면 공식 URL을 만들지 않는다",()=>{
  assert.throws(()=>buildOfficialCalendarUrl("","2026-09-06"));
  assert.throws(()=>buildOfficialCalendarUrl("SC240404","09/06/2026"));
});
