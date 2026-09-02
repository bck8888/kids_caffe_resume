"use client";
import { useMemo, useState } from "react";
import { createOnDeviceReservationIntent } from "@/lib/on-device/assistant-protocol";
import { planMobileHostAction } from "@/lib/on-device/host-planner";
import type { ScreenObservation } from "@/lib/on-device/screen-adapter";

const samples:{label:string;observation:ScreenObservation}[]=[
  {label:"공지 팝업",observation:{url:"https://umppa.seoul.go.kr/icare/",visibleText:"예약 전 안내사항 공지사항",controls:["닫기","오늘 하루 보지 않기"]}},
  {label:"서울시 로그인",observation:{url:"https://umppa.seoul.go.kr/login",visibleText:"통합로그인이 필요합니다",controls:["로그인"]}},
  {label:"날짜 선택",observation:{url:"https://umppa.seoul.go.kr/icare/calendar",visibleText:"예약일 날짜 선택 달력",controls:["이전 달","다음 달","날짜"]}},
  {label:"회차 선택",observation:{url:"https://umppa.seoul.go.kr/icare/slots",visibleText:"예약 회차와 잔여 좌석",controls:["회차","시간"]}},
  {label:"최종 검토",observation:{url:"https://umppa.seoul.go.kr/icare/review",visibleText:"신청 내용 확인 최종 확인",controls:["신청","예약하기"]}},
  {label:"알 수 없는 화면",observation:{url:"https://umppa.seoul.go.kr/icare/changed",visibleText:"페이지 구조가 변경되었습니다",controls:["확인"]}}
];

export default function EdgeAlphaPage(){
  const [index,setIndex]=useState(0);
  const intent=useMemo(()=>createOnDeviceReservationIntent({facilityId:"SCALPHA01",facilityName:"합성 알파 시설",date:"2026-09-05",selectedTime:"12:30",selectedSlot:{id:"alpha-slot-1",startTime:"13:00",endTime:"15:00"}}),[]);
  const decision=useMemo(()=>planMobileHostAction(samples[index].observation,intent),[index,intent]);
  return <main><header><p className="eyebrow">모바일 온디바이스 AI 안전성 실험</p><h1>예약 화면<br/>상태 어댑터</h1><p className="summary">특정 브라우저에 종속되지 않는 합성 실험입니다. 현재 서울시 페이지를 조작하거나 최종 신청하지 않습니다.</p></header><section aria-labelledby="simulator-title"><h2 id="simulator-title">화면 상태 선택</h2><div className="equipment-survey">{samples.map((sample,candidate)=><button type="button" className={candidate===index?"active":""} aria-pressed={candidate===index} key={sample.label} onClick={()=>setIndex(candidate)}>{sample.label}</button>)}</div><div className="edge-decision" aria-live="polite"><span>분류 상태</span><strong>{decision.state}</strong><span>신뢰도</span><strong>{Math.round(decision.confidence*100)}%</strong><span>허용 행동</span><strong>{decision.action.type}</strong><span>사용자 확인</span><strong>{decision.action.requiresUserConfirmation?"필요":"불필요"}</strong></div>{decision.action.type==="stop"&&<p className="message error">{decision.action.reason}</p>}</section><a className="back-link" href="/">예약 도우미로 돌아가기</a></main>;
}
