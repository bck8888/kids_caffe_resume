import assert from "node:assert/strict";
import test from "node:test";
import { planReservationAction, selectCandidateSlotChoices, selectCandidateSlots } from "./slot-selection.ts";
import type { ReservationSlot } from "./types.ts";

const slot = (id:string,startTime:string,endTime:string,remaining=3):ReservationSlot => ({ id, startTime, endTime, remaining, capacity:10, type:"개인", cancellationDeadline:"" });
const slots=[slot("morning","10:00","12:00"),slot("sold","12:30","13:30",0),slot("afternoon","14:00","16:00"),slot("evening","16:30","18:00")];

test("입력한 시간이 포함된 회차와 다음 예약 가능 회차를 구분한다",()=>{
  assert.deepEqual(selectCandidateSlotChoices(slots,"11:00").map(item=>[item.slot.id,item.relation]),[
    ["morning","contains_selected_time"],
    ["afternoon","next_available"]
  ]);
});

test("회차 사이의 시간이면 다음 회차라고 표시한다",()=>{
  assert.deepEqual(selectCandidateSlotChoices(slots,"13:40").map(item=>[item.slot.id,item.relation]),[
    ["afternoon","next_available"],
    ["evening","following_available"]
  ]);
});

test("입력한 시간을 포함한 회차가 매진이면 포함 회차라고 표시하지 않는다",()=>{
  assert.deepEqual(selectCandidateSlotChoices(slots,"12:30").map(item=>[item.slot.id,item.relation]),[
    ["afternoon","next_available"],
    ["evening","following_available"]
  ]);
});

test("기존 슬롯 배열 인터페이스와 사용자 확인 경계를 유지한다",()=>{
  assert.deepEqual(selectCandidateSlots(slots,"11:00").map(item=>item.id),["morning","afternoon"]);
  assert.equal(planReservationAction(slots,"11:00").type,"show_slots");
  assert.equal(planReservationAction(slots,"11:00","morning").type,"open_official_page");
});
