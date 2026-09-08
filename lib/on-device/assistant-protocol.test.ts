import assert from "node:assert/strict";
import test from "node:test";
import { createOnDeviceReservationIntent, validateOnDeviceReservationIntent } from "./assistant-protocol.ts";

const now=new Date("2026-09-03T03:00:00.000Z");
const input={facilityId:"SC240404",facilityName:"서울형 키즈카페",date:"2026-09-06",selectedTime:"12:30",selectedSlot:{id:"slot-2",startTime:"14:00",endTime:"16:00"}};

test("모바일 기기용 예약 맥락은 입력 시간을 바꾸지 않는다",()=>{
  const intent=createOnDeviceReservationIntent(input,now);
  assert.equal(intent.runtimeTarget,"mobile_on_device");
  assert.equal(intent.reservation.selectedTime,"12:30");
  assert.equal(intent.reservation.selectedSlot.startTime,"14:00");
  assert.equal(validateOnDeviceReservationIntent(intent,new Date("2026-09-03T03:30:00.000Z")),true);
});

test("만료되거나 허용 목록 밖 행동이 들어간 맥락을 거부한다",()=>{
  const expired=createOnDeviceReservationIntent(input,now);
  assert.equal(validateOnDeviceReservationIntent(expired,new Date("2026-09-03T04:00:01.000Z")),false);
  const unsafe={...createOnDeviceReservationIntent(input,now),allowedActions:["arbitrary_click"]};
  assert.equal(validateOnDeviceReservationIntent(unsafe,new Date("2026-09-03T03:30:00.000Z")),false);
  const invalidExpiry={...createOnDeviceReservationIntent(input,now),expiresAt:"not-a-date"};
  assert.equal(validateOnDeviceReservationIntent(invalidExpiry,new Date("2026-09-03T03:30:00.000Z")),false);
});

test("기본 연결 흐름은 최종 신청과 취소를 허용하지 않는다",()=>{
  const actions=createOnDeviceReservationIntent(input,now).allowedActions as string[];
  assert.equal(actions.includes("submit_reservation"),false);
  assert.equal(actions.includes("cancel_reservation"),false);
});
