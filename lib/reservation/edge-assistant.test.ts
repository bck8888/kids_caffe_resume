import assert from "node:assert/strict";
import test from "node:test";
import { planReservationAction, selectCandidateSlots } from "./edge-assistant.ts";
import type { ReservationSlot } from "./types.ts";

const slot = (id:string,startTime:string,endTime:string,remaining=3):ReservationSlot => ({ id, startTime, endTime, remaining, capacity:10, type:"개인", cancellationDeadline:"" });
const slots=[slot("morning","10:00","12:00"),slot("sold","12:30","13:30",0),slot("afternoon","14:00","16:00"),slot("evening","16:30","18:00")];

test("희망 시각을 포함한 회차와 다음 예약 가능 회차를 고른다",()=>{
  assert.deepEqual(selectCandidateSlots(slots,"11:00").map(item=>item.id),["morning","afternoon"]);
});

test("회차 사이의 시각이면 다음 두 회차를 고른다",()=>{
  assert.deepEqual(selectCandidateSlots(slots,"13:00").map(item=>item.id),["afternoon","evening"]);
});

test("매진 회차는 후보에서 제외한다",()=>{
  assert.deepEqual(selectCandidateSlots(slots,"12:30").map(item=>item.id),["afternoon","evening"]);
});

test("사용자 선택 없이는 공식 페이지 실행 행동을 만들지 않는다",()=>{
  assert.equal(planReservationAction(slots,"11:00").type,"show_slots");
  assert.equal(planReservationAction(slots,"11:00","morning").type,"open_official_page");
});
