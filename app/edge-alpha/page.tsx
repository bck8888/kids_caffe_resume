"use client";
import { useMemo, useState } from "react";
import { decideSafeAction, type ScreenObservation } from "@/lib/edge-ai/screen-adapter";

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
  const decision=useMemo(()=>decideSafeAction(samples[index].observation,{date:"2026-09-05",slotId:"alpha-slot-1",allowedFields:["보호자 연락처"]}),[index]);
  return <main><header><p className="eyebrow">로컬 Edge AI 안전성 실험</p><h1>예약 화면<br/>상태 어댑터</h1><p className="summary">합성 화면 신호만 사용합니다. 서울시 페이지를 조작하거나 최종 신청하지 않습니다.</p></header><section aria-labelledby="simulator-title"><h2 id="simulator-title">화면 상태 선택</h2><div className="equipment-survey">{samples.map((sample,candidate)=><button type="button" className={candidate===index?"active":""} aria-pressed={candidate===index} key={sample.label} onClick={()=>setIndex(candidate)}>{sample.label}</button>)}</div><div className="edge-decision" aria-live="polite"><span>분류 상태</span><strong>{decision.state}</strong><span>신뢰도</span><strong>{Math.round(decision.confidence*100)}%</strong><span>허용 행동</span><strong>{decision.action.type}</strong><span>사용자 확인</span><strong>{decision.action.requiresUserConfirmation?"필요":"불필요"}</strong></div>{decision.action.type==="stop"&&<p className="message error">{decision.action.reason}</p>}</section><a className="back-link" href="/">예약 도우미로 돌아가기</a></main>;
}
