"use client";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthStatus from "./auth-status";
import { loadLocalProfile, saveLocalProfile } from "@/lib/client/reservation-profile";
import { createOnDeviceReservationIntent, ON_DEVICE_INTENT_KEY } from "@/lib/on-device/assistant-protocol";
import { selectCandidateSlotChoices, type SlotRelation } from "@/lib/reservation/slot-selection";
import { buildOfficialCalendarUrl } from "@/lib/reservation/official-url";
import { recommendFacilities } from "@/lib/recommendation/rules";

type Facility = { id:string; name:string; district:string; address:string; age:string; phone:string; operatingDays:string; closedDays:string; latitude:string; longitude:string; equipmentTags?:string[] };
type Slot = { id:string; type:string; startTime:string; endTime:string; capacity:number; remaining:number; waitingCapacity:number; waiting:number; cancellationDeadline:string; careAvailable:boolean; program:string };
type SavedVisit = { facilityId:string; facilityName:string; date:string; slot:Slot; savedAt:string };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

export default function FacilitySearch() {
  const [facilities,setFacilities]=useState<Facility[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [facilitySource,setFacilitySource]=useState("");
  const [query,setQuery]=useState(""), [date,setDate]=useState(today), [desiredTime,setDesiredTime]=useState(""), [selectedId,setSelectedId]=useState("");
  const [slots,setSlots]=useState<Slot[]>([]), [slotLoading,setSlotLoading]=useState(false), [slotError,setSlotError]=useState("");
  const [saved,setSaved]=useState<SavedVisit[]>([]), [favoriteIds,setFavoriteIds]=useState<string[]>([]), [favoriteNotice,setFavoriteNotice]=useState("");
  const [preferredEquipment,setPreferredEquipment]=useState<string[]>([]);
  const [showFacilityPicker,setShowFacilityPicker]=useState(false);

  useEffect(()=>{
    const stored=localStorage.getItem("kids-cafe-visits"); if(stored){try{setSaved(JSON.parse(stored));}catch{localStorage.removeItem("kids-cafe-visits");}}
    const profile=loadLocalProfile(); setFavoriteIds(profile.favoriteFacilityIds);setPreferredEquipment(profile.preferredEquipment); if(profile.intent){setDate(profile.intent.date);setDesiredTime(profile.intent.desiredTime);}
    fetch("/api/facilities").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"시설정보를 불러오지 못했습니다.");return data;}).then(data=>{const loaded=data.facilities as Facility[];setFacilities(loaded);setFacilitySource(data.source??"");const validFavorites=profile.favoriteFacilityIds.filter(id=>loaded.some(item=>item.id===id)).slice(0,3);setFavoriteIds(validFavorites);if(validFavorites.length!==profile.favoriteFacilityIds.length)saveLocalProfile({...profile,favoriteFacilityIds:validFavorites});const restored=profile.intent?.facilityId;setSelectedId(restored&&loaded.some(item=>item.id===restored)?restored:"");}).catch((reason:Error)=>setError(reason.message)).finally(()=>setLoading(false));
  },[]);
  const visibleFacilities=useMemo(()=>{const keyword=query.trim().toLowerCase();const result=keyword?facilities.filter(f=>`${f.name} ${f.district} ${f.address}`.toLowerCase().includes(keyword)):facilities;return result.slice(0,8);},[facilities,query]);
  const selected=facilities.find(f=>f.id===selectedId);
  const favorites=favoriteIds.map(id=>facilities.find(f=>f.id===id)).filter((item):item is Facility=>Boolean(item));
  const displayedSlots=useMemo(()=>selectCandidateSlotChoices(slots,desiredTime),[slots,desiredTime]);
  const recommendations=useMemo(()=>recommendFacilities(facilities,preferredEquipment,favoriteIds).map(result=>({...result,facility:facilities.find(item=>item.id===result.facilityId)})).filter(item=>item.facility),[facilities,preferredEquipment,favoriteIds]);
  const selectFacility=useCallback((id:string)=>{setSelectedId(id);setSlots([]);setSlotError("");setShowFacilityPicker(false);},[]);
  useEffect(()=>{if(!selected)return;const profile=loadLocalProfile();saveLocalProfile({...profile,favoriteFacilityIds:favoriteIds,preferredEquipment,intent:{facilityId:selected.id,facilityName:selected.name,date,desiredTime,updatedAt:new Date().toISOString()}});},[date,desiredTime,favoriteIds,preferredEquipment,selected]);
  function toggleFavorite(id:string){setFavoriteIds(current=>{const next=current.includes(id)?current.filter(item=>item!==id):current.length<3?[...current,id]:current;if(next===current){setFavoriteNotice("자주 가는 곳은 최대 3곳까지 저장할 수 있어요.");return current;}const profile=loadLocalProfile();saveLocalProfile({...profile,favoriteFacilityIds:next});setFavoriteNotice(next.includes(id)?"자주 가는 곳에 저장했어요.":"자주 가는 곳에서 삭제했어요.");return next;});}
  function toggleEquipment(tag:string){setPreferredEquipment(current=>current.includes(tag)?current.filter(item=>item!==tag):[...current,tag]);}
  async function loadSlots(){if(!selected||!date)return;if(!desiredTime){setSlotError("이용하고 싶은 시간을 입력해 주세요.");return;}setSlotLoading(true);setSlotError("");setSlots([]);try{const response=await fetch(`/api/reservations?facilityId=${encodeURIComponent(selected.id)}&date=${date}`);const data=await response.json();if(!response.ok)throw new Error(data.error||"회차정보를 불러오지 못했습니다.");setSlots(data.slots);}catch(reason){setSlotError(reason instanceof Error?reason.message:"회차정보를 불러오지 못했습니다.");}finally{setSlotLoading(false);}}
  function officialUrl(){return selected?buildOfficialCalendarUrl(selected.id,date):"#";}
  function continueOnSeoul(slot:Slot){
    if(!selected)return;
    const intent=createOnDeviceReservationIntent({facilityId:selected.id,facilityName:selected.name,date,selectedTime:desiredTime,selectedSlot:slot});
    localStorage.setItem(ON_DEVICE_INTENT_KEY,JSON.stringify(intent));
    const profile=loadLocalProfile();
    saveLocalProfile({...profile,intent:{facilityId:selected.id,facilityName:selected.name,date,desiredTime,selectedSlotId:slot.id,updatedAt:new Date().toISOString()}});
    window.open(officialUrl(),"_blank","noopener,noreferrer");
  }
  function saveVisit(slot:Slot){if(!selected)return;const next=[{facilityId:selected.id,facilityName:selected.name,date,slot,savedAt:new Date().toISOString()},...saved].filter((visit,index,all)=>all.findIndex(item=>item.facilityId===visit.facilityId&&item.date===visit.date&&item.slot.id===visit.slot.id)===index).slice(0,10);setSaved(next);localStorage.setItem("kids-cafe-visits",JSON.stringify(next));}
  function removeVisit(index:number){const next=saved.filter((_,candidate)=>candidate!==index);setSaved(next);localStorage.setItem("kids-cafe-visits",JSON.stringify(next));}
  async function shareFacility(){if(!selected)return;const url=officialUrl();try{if(window.Kakao?.Share){window.Kakao.Share.sendDefault({objectType:"text",text:`${selected.name}\n${date} 예약 가능 시간을 확인해보세요.`,link:{mobileWebUrl:url,webUrl:url},buttonTitle:"예약 확인"});return;}}catch{}if(navigator.share)await navigator.share({title:selected.name,text:`${date} 예약 확인`,url});else await navigator.clipboard.writeText(url);}
  const slotLabel=(relation:SlotRelation)=>relation==="contains_selected_time"?"입력한 시간이 포함된 회차":relation==="next_available"?"입력한 시간 이후 첫 회차":"그 다음 이용 가능 회차";

  return <>
    <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" strategy="afterInteractive" onLoad={()=>{const key=process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;if(key&&window.Kakao&&!window.Kakao.isInitialized())window.Kakao.init(key);}}/>

    <AuthStatus/>

    <section className="booking-flow" aria-labelledby="booking-title">
      <div className="flow-heading">
        <div><p className="card-kicker">이번 예약</p><h2 id="booking-title">{!selected?"어디에서 놀까요?":!slots.length?"언제 이용할까요?":"신청할 회차를 고르세요"}</h2></div>
        <span className="step-indicator">{selected?slots.length?"3/3":"2/3":"1/3"}</span>
      </div>

      {!selected&&<div className="choice-block active-choice">
        <span className="choice-number">1</span>
        <div className="choice-content">
          <strong>이용할 키즈카페</strong>
          <button type="button" className="empty-choice" onClick={()=>setShowFacilityPicker(true)}>키즈카페 선택하기</button>
          {favorites.length>0&&<div className="quick-favorites" aria-label="자주 가는 곳">{favorites.map(f=><button key={f.id} type="button" onClick={()=>selectFacility(f.id)}>{f.name}</button>)}</div>}
        </div>
      </div>}

      {showFacilityPicker&&<div className="facility-picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <div className="picker-heading"><div><p className="card-kicker">키즈카페 찾기</p><h2 id="picker-title">한 곳을 선택해 주세요</h2></div><button type="button" className="close-picker" onClick={()=>setShowFacilityPicker(false)} aria-label="시설 선택 닫기">닫기</button></div>
        <label>시설명·동네·주소<input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 방배, 마포"/></label>
        {facilitySource==="synthetic-alpha-fixture"&&<p className="alpha-badge">합성 알파 데이터 · 운영 사용 금지</p>}
        <div className="picker-results" aria-live="polite" aria-busy={loading}>
          {loading&&<p className="message">시설정보를 불러오는 중입니다.</p>}
          {error&&<p className="message error">{error}</p>}
          {!loading&&!error&&!visibleFacilities.length&&<p className="message">검색 결과가 없습니다.</p>}
          {visibleFacilities.map(f=>{const isFavorite=favoriteIds.includes(f.id);return <div key={f.id} className="picker-row"><button type="button" className="picker-select" onClick={()=>selectFacility(f.id)}><strong>{f.name}</strong><span>{f.address||"주소 확인 필요"}</span></button><button type="button" className={`favorite-star ${isFavorite?"active":""}`} aria-label={isFavorite?`${f.name} 자주 가는 곳에서 삭제`:`${f.name} 자주 가는 곳에 저장`} aria-pressed={isFavorite} onClick={()=>toggleFavorite(f.id)}>{isFavorite?"★":"☆"}</button></div>})}
        </div>
        {favoriteNotice&&<p className="save-notice success" role="status">{favoriteNotice}</p>}
        {!loading&&!error&&facilities.length>visibleFacilities.length&&<p className="result-hint">검색 결과는 최대 8곳만 보여드려요.</p>}
      </div>}

      {selected&&!slots.length&&<>
        <button type="button" className="flow-context" onClick={()=>setShowFacilityPicker(true)}><span>{selected.name}</span><small>{selected.address||"주소 확인 필요"}</small><em>시설 변경</em></button>
        <div className="choice-block active-choice">
        <span className="choice-number">2</span>
        <div className="choice-content">
          <strong>이용 날짜와 시간을 입력하세요</strong>
          <p className="choice-help">입력한 시간을 바꾸지 않고, 해당 시간을 포함하거나 이후에 이용할 수 있는 회차를 보여드려요.</p>
          <div className="form-grid reservation-intent"><label>이용 날짜<input type="date" min={today} value={date} onChange={e=>{setDate(e.target.value);setSlots([]);}}/></label><label>이용하고 싶은 시간<input type="time" value={desiredTime} onChange={e=>{setDesiredTime(e.target.value);setSlots([]);}}/></label></div>
          <button type="button" onClick={loadSlots} disabled={slotLoading||!desiredTime}>{slotLoading?"확인 중…":"이용 가능한 시간 보기"}</button>
          {slotError&&<p className="message error">{slotError}</p>}
        </div>
      </div></>}

      {selected&&slots.length>0&&<div className="choice-block slot-choice">
        <span className="choice-number">3</span>
        <div className="choice-content">
          <button type="button" className="flow-context compact" onClick={()=>setSlots([])}><span>{selected.name}</span><small>{date} · 입력한 시간 {desiredTime}</small><em>조건 변경</em></button>
          <strong className="slot-question">서울시에서 확인할 회차</strong>
          {!displayedSlots.length&&<p className="message">{desiredTime} 이후 이용 가능한 회차가 없습니다.</p>}
          <div className="slot-list">{displayedSlots.map(({slot,relation})=><article className={`slot ${relation==="contains_selected_time"?"best-match":"next-match"}`} key={slot.id}><div className="slot-label">{slotLabel(relation)}</div><div className="slot-heading"><strong>{slot.startTime}–{slot.endTime}</strong><span>{slot.type||"개인"}</span></div><p className="seat-count"><b>{slot.remaining}자리</b> 남음 <span>정원 {slot.capacity}명</span></p>{slot.cancellationDeadline&&<p>취소 가능: {slot.cancellationDeadline}</p>}<div className="slot-actions"><button type="button" className="official-action" onClick={()=>continueOnSeoul(slot)}>서울시에서 계속하기</button><button type="button" onClick={()=>saveVisit(slot)}>후보로 저장</button></div></article>)}</div>
          <p className="official-note">서울시 로그인이 필요할 수 있어요. 공식 페이지에서 날짜와 회차를 다시 확인하고 최종 신청해 주세요.</p>
        </div>
      </div>}
    </section>

    <nav className="utility-actions" aria-label="추가 기능">
      <button type="button" onClick={()=>setShowFacilityPicker(true)}>자주 가는 곳 {favoriteIds.length}/3</button>
      {selected&&<button type="button" onClick={shareFacility}>카카오톡 공유</button>}
    </nav>

    {saved.length>0&&<details className="saved-disclosure"><summary>저장한 예약 후보 <span>{saved.length}</span></summary><div className="saved-list">{saved.map((visit,index)=><article className="saved-item" key={`${visit.facilityId}-${visit.date}-${visit.slot.id}`}><div><strong>{visit.facilityName}</strong><span>{visit.date} · {visit.slot.startTime}–{visit.slot.endTime}</span><span>저장만으로 예약이 완료되지는 않습니다.</span></div><button type="button" aria-label={`${visit.facilityName} 예약 후보 삭제`} onClick={()=>removeVisit(index)}>삭제</button></article>)}</div></details>}

    {facilitySource==="synthetic-alpha-fixture"&&<details className="experiment-disclosure"><summary>합성 데이터 추천 실험</summary><div className="experiment-body"><p>실제 시설 데이터가 아닌 합성 알파 데이터로만 시험합니다.</p><div className="equipment-survey">{["클라이밍","트램펄린","볼풀","블록"].map(tag=><button type="button" key={tag} className={preferredEquipment.includes(tag)?"active":""} aria-pressed={preferredEquipment.includes(tag)} onClick={()=>toggleEquipment(tag)}>{tag}</button>)}</div>{recommendations.length?<div className="recommendation-list">{recommendations.map(item=><button type="button" key={item.facilityId} onClick={()=>selectFacility(item.facilityId)}><strong>{item.facility?.name}</strong><span>{item.reasons.join(" · ")}</span></button>)}</div>:<p className="message">선호 기구를 선택해 주세요.</p>}</div></details>}
  </>;
}
declare global { interface Window { Kakao?: any } }
