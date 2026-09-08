import { setTimeout as delay } from "node:timers/promises";
import { PARSER_VERSION, normalizeSeoulFacility, normalizeUmppaCalendar, normalizeUmppaDetail, sha256 } from "./normalize.mjs";
import { addAssertion, ensureSource, saveCalendarKnowledge, saveDetailKnowledge, saveSnapshot, upsertFacility } from "./repository.mjs";

const SOURCE_DEFS = {
  seoul: {key:"seoul-open-api",name:"Seoul Open Data facility feed",type:"official_api",authority:"Seoul Metropolitan Government",baseUrl:"http://openapi.seoul.go.kr:8088",policyStatus:"approved_public",properties:{service:"tnFcltySttusInfo1011"}},
  detail: {key:"umppa-public-detail",name:"UMPPA public facility detail",type:"public_html",authority:"Seoul UMPPA",baseUrl:"https://umppa.seoul.go.kr",policyStatus:"policy_review_required",properties:{authenticated:false}},
  calendar: {key:"umppa-public-calendar",name:"UMPPA public reservation calendar",type:"public_html",authority:"Seoul UMPPA",baseUrl:"https://umppa.seoul.go.kr",policyStatus:"policy_review_required",properties:{authenticated:false,availabilityVolatile:true}}
};

async function fetchWithRetry(url, { accept, attempts=3 }) {
  let last;
  for(let attempt=1;attempt<=attempts;attempt++) try {
    const response=await fetch(url,{headers:{Accept:accept,"User-Agent":"seoul-kids-facility-knowledge/1.0 (+conservative-public-research)"},redirect:"follow",signal:AbortSignal.timeout(20000)});
    const body=await response.text();
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return {response,body};
  } catch(error) { last=error; if(attempt<attempts) await delay(500*attempt); }
  throw last;
}

function markTarget(db, sourceId, targetKey, facilitySourceId, status, snapshotId=null, error=null) {
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO collection_targets(source_id,target_key,facility_source_id,status,attempts,last_attempt_at,last_success_at,last_snapshot_id,error_text,properties_json)
    VALUES(?,?,?,?,1,?,?,?,?, '{}') ON CONFLICT(source_id,target_key) DO UPDATE SET status=excluded.status,attempts=collection_targets.attempts+1,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,last_snapshot_id=excluded.last_snapshot_id,error_text=excluded.error_text`)
    .run(sourceId,targetKey,facilitySourceId,status,now,status==='succeeded'?now:null,snapshotId,error?.message??null);
}

export async function collect(db,{apiKey,month,rateLimitMs=350,refresh=false,onProgress=()=>{}}) {
  if(!apiKey) throw new Error("SEOUL_OPEN_API_KEY is required through the existing .env.local loader");
  const [yearValue,monthValue]=month.split("-").map(Number);
  const sourceIds=Object.fromEntries(Object.entries(SOURCE_DEFS).map(([key,value])=>[key,ensureSource(db,value)]));
  const startedAt=new Date().toISOString();
  const run=Number(db.prepare("INSERT INTO collection_runs(started_at,status,parser_version,requested_month,properties_json) VALUES(?,'running',?,?, '{}')").run(startedAt,PARSER_VERSION,month).lastInsertRowid);
  const failures=[];
  try {
    const apiUrl=`http://openapi.seoul.go.kr:8088/${encodeURIComponent(apiKey)}/json/tnFcltySttusInfo1011/1/1000/`;
    const {response,body}=await fetchWithRetry(apiUrl,{accept:"application/json"});
    const observedAt=new Date().toISOString();
    const apiSnapshot=saveSnapshot(db,{sourceId:sourceIds.seoul,runId:run,requestKey:"tnFcltySttusInfo1011:1:1000",publicUrl:"http://openapi.seoul.go.kr:8088/{API_KEY}/json/tnFcltySttusInfo1011/1/1000/",mediaType:"application/json",httpStatus:response.status,hash:sha256(body),body,retrievedAt:observedAt,knownAt:observedAt,parserVersion:PARSER_VERSION,verificationState:"confirmed",parseStatus:"parsed"});
    const payload=JSON.parse(body); const service=payload.tnFcltySttusInfo1011;
    if(!Array.isArray(service?.row)) throw new Error("Unexpected Seoul Open API payload");
    const facilities=[];
    for(const row of service.row) {
      const value=normalizeSeoulFacility(row); if(!value.sourceFacilityId||!value.canonicalName) continue;
      const facilityId=upsertFacility(db,value,apiSnapshot,observedAt);
      for(const [predicate,fact] of Object.entries(value.assertions)) addAssertion(db,{facilityId,predicate:`open_api.${predicate}`,value:fact,snapshotId:apiSnapshot,observedAt,parserVersion:PARSER_VERSION});
      facilities.push({facilityId,value});
    }
    onProgress({phase:"facility-feed",completed:facilities.length,total:service.list_total_count??facilities.length});
    for(let index=0;index<facilities.length;index++) {
      const {facilityId,value}=facilities[index];
      for(const kind of ["detail","calendar"]) {
        const sourceId=sourceIds[kind]; const targetKey=kind==='detail'?value.sourceFacilityId:`${value.sourceFacilityId}:${month}`;
        const url=kind==='detail'?value.officialDetailUrl:`${value.officialCalendarUrl}&q_year=${yearValue}&q_month=${String(monthValue).padStart(2,"0")}`;
        const completedTarget=db.prepare("SELECT status FROM collection_targets WHERE source_id=? AND target_key=?").get(sourceId,targetKey);
        if(completedTarget?.status==='succeeded'&&!refresh) continue;
        markTarget(db,sourceId,targetKey,value.sourceFacilityId,"running");
        try {
          const fetched=await fetchWithRetry(url,{accept:"text/html"}); const retrievedAt=new Date().toISOString();
          const snapshotId=saveSnapshot(db,{sourceId,runId:run,requestKey:targetKey,publicUrl:url,mediaType:"text/html",httpStatus:fetched.response.status,hash:sha256(fetched.body),body:fetched.body,retrievedAt,knownAt:retrievedAt,parserVersion:PARSER_VERSION,verificationState:"confirmed",parseStatus:"parsed",properties:{facilityId:value.sourceFacilityId,month:kind==='calendar'?month:undefined}});
          if(kind==='detail') saveDetailKnowledge(db,facilityId,normalizeUmppaDetail(fetched.body,url),snapshotId,retrievedAt,PARSER_VERSION);
          else saveCalendarKnowledge(db,facilityId,normalizeUmppaCalendar(fetched.body,yearValue,monthValue,retrievedAt),snapshotId,retrievedAt,PARSER_VERSION);
          markTarget(db,sourceId,targetKey,value.sourceFacilityId,"succeeded",snapshotId);
        } catch(error) { failures.push({facilityId:value.sourceFacilityId,source:kind,error:error.message}); markTarget(db,sourceId,targetKey,value.sourceFacilityId,"failed",null,error); }
        await delay(rateLimitMs);
      }
      onProgress({phase:"public-pages",completed:index+1,total:facilities.length,failures:failures.length});
    }
    const completedAt=new Date().toISOString(); const status=failures.length?'partial':'completed';
    db.prepare("UPDATE collection_runs SET completed_at=?,status=?,properties_json=? WHERE id=?").run(completedAt,status,JSON.stringify({facilityCount:facilities.length,failures}),run);
    return {runId:run,status,facilityCount:facilities.length,sourceTotal:Number(service.list_total_count??facilities.length),failures};
  } catch(error) { db.prepare("UPDATE collection_runs SET completed_at=?,status='failed',properties_json=? WHERE id=?").run(new Date().toISOString(),JSON.stringify({error:error.message}),run); throw error; }
}
