import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClockTime } from "./normalize.ts";

test("UMPPA HHmm 시간을 HH:mm으로 변환한다",()=>{assert.equal(normalizeClockTime("0940"),"09:40");assert.equal(normalizeClockTime("1540"),"15:40");});
test("세 자리 시간과 이미 정규화된 시간을 처리한다",()=>{assert.equal(normalizeClockTime("940"),"09:40");assert.equal(normalizeClockTime("09:40"),"09:40");});
test("잘못된 시간은 원문을 유지한다",()=>{assert.equal(normalizeClockTime("2560"),"2560");assert.equal(normalizeClockTime("미정"),"미정");});
