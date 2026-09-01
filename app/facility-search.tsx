"use client";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useState } from "react";
import KakaoMap from "./kakao-map";

type Facility = { id:string; name:string; district:string; address:string; age:string; phone:string; operatingDays:string; closedDays:string; latitude:string; longitude:string };
type Slot = { id:string; type:string; startTime:string; endTime:string; capacity:number; remaining:number; waitingCapacity:number; waiting:number; cancellationDeadline:string; careAvailable:boolean; program:string };
type SavedVisit = { facilityId:string; facilityName:string; date:string; slot:Slot; savedAt:string };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

export default function FacilitySearch() {
  const [facilities,setFacilities]=useState<Facility[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [query,setQuery]=useState(""), [date,setDate]=useState(today), [selectedId,setSelectedId]=useState("");
  const [slots,setSlots]=useState<Slot[]>([]), [slotLoading,setSlotLoading]=useState(false), [slotError,setSlotError]=useState("");
  const [saved,setSaved]=useState<SavedVisit[]>([]), [mapVisible,setMapVisible]=useState(false);

  useEffect(()=>{
    const stored=localStorage.getItem("kids-cafe-visits");
    if(stored){try{setSaved(JSON.parse(stored));}catch{localStorage.removeItem("kids-cafe-visits");}}
    fetch("/api/facilities").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"시설정보를 불러오지 못했습니다.");return data;})
      .then(data=>{setFacilities(data.facilities);if(data.facilities[0])setSelectedId(data.facilities[0].id);})
      .catch((reason:Error)=>setError(reason.message)).finally(()=>setLoading(false));
  },[]);

  const visibleFacilities=useMemo(()=>{const keyword=query.trim().toLowerCase();const result=keyword?facilities.filter(f=>`${f.name} ${f.district} ${f.address}`.toLowerCase().includes(keyword)):facilities;return result.slice(0,30);},[facilities,query]);
  const selected=facilities.find(f=>f.id===selectedId);
  const selectFacility=useCallback((id:string)=>{setSelectedId(id);setSlots([]);setSlotError("");},[]);

  async function loadSlots(){if(!selected||!date)return;setSlotLoading(true);setSlotError("");setSlots([]);try{const response=await fetch(`/api/reservations?facilityId=${encodeURIComponent(selected.id)}&date=${date}`);const data=await response.json();if(!response.ok)throw new Error(data.error||"회차정보를 불러오지 못했습니다.");setSlots(data.slots);}catch(reason){setSlotError(reason instanceof Error?reason.message:"회차정보를 불러오지 못했습니다.");}finally{setSlotLoading(false);}}
  function officialUrl(slot?:Slot){if(!selected)return"#";const params=new URLSearchParams({q_useSeCode:"1001",q_dayNo:String(new Date(`${date}T00:00:00+09:00`).getDay()+1),q_resveDe:date,q_year:date.slice(0,4),q_month:date.slice(5,7),q_fcltyId:selected.id});if(slot){params.set("q_tmeSn",slot.id);params.set("q_resveTmeSn",slot.id);params.set("q_reqstPosblCo",String(slot.remaining));}return`https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveRs.do?${params}`;}
  function saveVisit(slot:Slot){if(!selected)return;const next=[{facilityId:selected.id,facilityName:selected.name,date,slot,savedAt:new Date().toISOString()},...saved].filter((visit,index,all)=>all.findIndex(item=>item.facilityId===visit.facilityId&&item.date===visit.date&&item.slot.id===visit.slot.id)===index).slice(0,10);setSaved(next);localStorage.setItem("kids-cafe-visits",JSON.stringify(next));}
  function removeVisit(index:number){const next=saved.filter((_,candidate)=>candidate!==index);setSaved(next);localStorage.setItem("kids-cafe-visits",JSON.stringify(next));}
  async function shareFacility(){if(!selected)return;const url=officialUrl();try{if(window.Kakao?.Share){window.Kakao.Share.sendDefault({objectType:"text",text:`${selected.name}\n${date} 예약 가능 시간을 확인해보세요.`,link:{mobileWebUrl:url,webUrl:url},buttonTitle:"예약 확인"});return;}}catch{}if(navigator.share)await navigator.share({title:selected.name,text:`${date} 예약 확인`,url});else await navigator.clipboard.writeText(url);}

  return <>
    <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" strategy="afterInteractive" onLoad={()=>{if(window.Kakao&&!window.Kakao.isInitialized())window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);}}/>
    <section aria-labelledby="search-title"><h2 id="search-title">시설 찾기</h2><div className="form-grid"><label>이용 날짜<input type="date" min={today} value={date} onChange={e=>{setDate(e.target.value);setSlots([]);}}/></label><label>동네·시설명<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 방배, 마포"/></label></div><button type="button" onClick={()=>setMapVisible(value=>!value)}>{mapVisible?"목록만 보기":"카카오맵으로 보기"}</button>{mapVisible&&<KakaoMap facilities={facilities} selectedId={selectedId} onSelect={selectFacility}/>}</section>
    <section className="results" aria-live="polite" aria-busy={loading}><div className="results-heading"><h2>서울형 키즈카페</h2>{!loading&&!error&&<span>{facilities.length}개 시설</span>}</div>{loading&&<p className="message">시설정보를 불러오는 중입니다.</p>}{error&&<p className="message error">{error}</p>}{!loading&&!error&&visibleFacilities.length===0&&<p className="message">검색 결과가 없습니다.</p>}<div className="facility-list">{visibleFacilities.map(f=><button key={f.id} type="button" className={`facility-card ${selectedId===f.id?"selected":""}`} onClick={()=>selectFacility(f.id)}><span className="card-title"><span className="district">{f.district||"서울"}</span><strong>{f.name||"시설명 확인 필요"}</strong></span><span className="address">{f.address||"주소 확인 필요"}</span>{(f.age||f.operatingDays)&&<span className="metadata">{[f.age,f.operatingDays].filter(Boolean).join(" · ")}</span>}</button>)}</div></section>
    {selected&&<section className="booking" aria-live="polite"><p className="eyebrow">선택한 시설</p><h2>{selected.name}</h2><p className="section-copy">{date}의 회차와 남은 자리를 확인합니다.</p><button type="button" onClick={loadSlots} disabled={slotLoading}>{slotLoading?"확인 중…":"회차·잔여석 확인"}</button>{slotError&&<p className="message error">{slotError}</p>}{!slotLoading&&!slotError&&slots.length===0&&<p className="message">회차 조회 전이거나 예약 가능한 회차가 없습니다.</p>}<div className="slot-list">{slots.map(slot=><article className="slot" key={slot.id}><div><strong>{slot.startTime}–{slot.endTime}</strong><span>{slot.type||"개인"}</span></div><p><b>{slot.remaining}자리</b> 남음 · 정원 {slot.capacity}명</p>{slot.cancellationDeadline&&<p>취소 가능: {slot.cancellationDeadline}</p>}<div className="slot-actions"><a href={officialUrl(slot)} target="_blank" rel="noreferrer">공식 예약</a><button type="button" onClick={()=>saveVisit(slot)}>일정 저장</button></div></article>)}</div><button type="button" className="secondary" onClick={shareFacility}>카카오톡으로 공유</button></section>}
    <section className="saved"><div className="results-heading"><h2>저장한 일정</h2><span>{saved.length}개</span></div>{saved.length===0&&<p className="message">예약 후 회차를 저장하면 취소기한을 다시 확인할 수 있습니다.</p>}{saved.map((visit,index)=><article className="saved-item" key={`${visit.facilityId}-${visit.date}-${visit.slot.id}`}><div><strong>{visit.facilityName}</strong><span>{visit.date} · {visit.slot.startTime}–{visit.slot.endTime}</span>{visit.slot.cancellationDeadline&&<span>취소 가능: {visit.slot.cancellationDeadline}</span>}</div><button type="button" aria-label={`${visit.facilityName} 일정 삭제`} onClick={()=>removeVisit(index)}>삭제</button></article>)}</section>
  </>;
}
declare global { interface Window { Kakao?: any } }
