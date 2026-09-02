import assert from "node:assert/strict";
import test from "node:test";
import { recommendFacilities } from "./rules.ts";

const facilities=[{id:"a",name:"A",equipmentTags:["클라이밍","블록"]},{id:"b",name:"B",equipmentTags:["트램펄린"]},{id:"c",name:"C",equipmentTags:["클라이밍","트램펄린"]}];
test("선호 기구 일치 수로 최대 3곳을 추천한다",()=>{assert.deepEqual(recommendFacilities(facilities,["클라이밍","트램펄린"],[]).map(item=>item.facilityId),["c","a","b"]);});
test("근거 없는 시설은 추천하지 않는다",()=>{assert.equal(recommendFacilities(facilities,["볼풀"],[]).length,0);});
test("선호 기구가 없으면 즐겨찾기만으로 추천하지 않는다",()=>{assert.equal(recommendFacilities(facilities,[],["a"]).length,0);});
test("추천 결과에 알고리즘 버전과 이유를 남긴다",()=>{const [result]=recommendFacilities(facilities,["클라이밍"],[]);assert.equal(result.algorithmVersion,"rules-v1");assert.ok(result.reasons.length>0);});
