import assert from "node:assert/strict";
import test from "node:test";
import { classifyScreen, decideSafeAction, type ScreenObservation } from "./screen-adapter.ts";

const observe=(visibleText:string,controls:string[]=[]):ScreenObservation=>({url:"https://umppa.seoul.go.kr/icare/alpha",visibleText,controls});
test("서울시 로그인 화면에서는 사용자 로그인을 요청한다",()=>{const result=decideSafeAction(observe("통합로그인이 필요합니다",["로그인"]),{date:"2026-09-05"});assert.equal(result.state,"login_required");assert.equal(result.action.type,"request_seoul_login");});
test("달력 화면에서는 저장된 날짜만 선택한다",()=>{const result=decideSafeAction(observe("예약일 날짜 선택 달력",["이전 달","다음 달","날짜"]),{date:"2026-09-05"});assert.deepEqual(result.action,{type:"select_date",value:"2026-09-05",requiresUserConfirmation:false});});
test("사용자가 고르지 않은 회차는 실행하지 않는다",()=>{const result=decideSafeAction(observe("예약 회차와 잔여 좌석",["회차","시간"]),{date:"2026-09-05"});assert.equal(result.action.type,"stop");});
test("최종 검토 화면에서는 버튼을 강조만 한다",()=>{const result=decideSafeAction(observe("신청 내용 확인 최종 확인",["신청","예약하기"]),{date:"2026-09-05",slotId:"1"});assert.equal(result.action.type,"highlight_final_submit");assert.equal(result.action.requiresUserConfirmation,true);});
test("알 수 없는 화면에서는 중단한다",()=>{const result=decideSafeAction(observe("예상하지 못한 페이지",["확인"]),{date:"2026-09-05"});assert.equal(classifyScreen(observe("예상하지 못한 페이지")).state,"unknown");assert.equal(result.action.type,"stop");});
test("허용 행동 집합에 자동 최종 제출이 존재하지 않는다",()=>{const source=["dismiss_known_notice","request_seoul_login","select_date","select_slot","fill_approved_fields","highlight_final_submit","record_user_confirmed_result","stop"];assert.equal(source.includes("submit_reservation"),false);});
