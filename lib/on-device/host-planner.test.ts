import assert from "node:assert/strict";
import test from "node:test";
import { createOnDeviceReservationIntent } from "./assistant-protocol.ts";
import { planMobileHostAction } from "./host-planner.ts";

const now=new Date("2026-09-03T03:00:00.000Z");
const intent=createOnDeviceReservationIntent({
  facilityId:"SC240404",
  facilityName:"서울형 키즈카페",
  date:"2026-09-06",
  selectedTime:"12:30",
  selectedSlot:{id:"slot-2",startTime:"14:00",endTime:"16:00"}
},now);

test("서울시 공식 화면의 알려진 공지 팝업만 닫도록 계획한다",()=>{
  const result=planMobileHostAction({url:"https://umppa.seoul.go.kr/icare/calendar",visibleText:"예약 전 안내사항 공지사항",controls:["닫기","오늘 하루 보지 않기"]},intent,new Date("2026-09-03T03:10:00.000Z"));
  assert.equal(result.action.type,"dismiss_known_notice");
  assert.equal(result.action.requiresUserConfirmation,false);
});

test("선택한 회차 ID를 바꾸지 않고 전달한다",()=>{
  const result=planMobileHostAction({url:"https://umppa.seoul.go.kr/icare/calendar",visibleText:"예약 회차와 잔여 좌석",controls:["회차","시간"]},intent,new Date("2026-09-03T03:10:00.000Z"));
  assert.deepEqual(result.action,{type:"select_slot",value:"slot-2",requiresUserConfirmation:false});
});

test("공식 출처가 아니거나 예약 맥락이 만료되면 중단한다",()=>{
  const otherOrigin=planMobileHostAction({url:"https://example.com/icare",visibleText:"공지사항",controls:["닫기"]},intent,new Date("2026-09-03T03:10:00.000Z"));
  assert.equal(otherOrigin.action.type,"stop");
  const expired=planMobileHostAction({url:"https://umppa.seoul.go.kr/icare",visibleText:"공지사항",controls:["닫기"]},intent,new Date("2026-09-03T04:00:01.000Z"));
  assert.equal(expired.action.type,"stop");
});

test("최종 검토에서는 제출하지 않고 버튼만 강조한다",()=>{
  const result=planMobileHostAction({url:"https://umppa.seoul.go.kr/icare/review",visibleText:"신청 내용 확인 최종 확인",controls:["신청","예약하기"]},intent,new Date("2026-09-03T03:10:00.000Z"));
  assert.equal(result.action.type,"highlight_final_submit");
});
