import test from "node:test";
import assert from "node:assert/strict";
import { kakaoCallbackUrl, resolveAppOrigin } from "./app-url.ts";

test("등록된 앱 URL을 카카오 콜백 기준으로 사용한다",()=>{
  assert.equal(kakaoCallbackUrl("http://internal:3000","https://alpha.example.com/path"),"https://alpha.example.com/api/auth/kakao/callback");
});

test("앱 URL이 없으면 요청 origin을 사용한다",()=>{
  assert.equal(resolveAppOrigin("http://localhost:3000"),"http://localhost:3000");
});

test("http와 https 이외의 앱 URL을 거부한다",()=>{
  assert.throws(()=>resolveAppOrigin("http://localhost:3000","javascript:alert(1)"));
});
