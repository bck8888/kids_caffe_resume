import test from "node:test";
import assert from "node:assert/strict";
import { createSignedSession, readSignedSession } from "./session-token.ts";

const secret="alpha-test-secret-that-is-longer-than-32-characters";
const user={id:"kakao:123",nickname:"알파 사용자",provider:"kakao" as const};

test("서명된 카카오 서비스 세션을 복원한다",()=>{
  const token=createSignedSession(user,secret,1_000);
  assert.deepEqual(readSignedSession(token,secret,2_000),{...user,expiresAt:604_801_000});
});

test("변조되거나 다른 비밀키로 서명된 세션을 거부한다",()=>{
  const token=createSignedSession(user,secret,1_000);
  assert.equal(readSignedSession(`${token}x`,secret,2_000),null);
  assert.equal(readSignedSession(token,"different-secret-that-is-also-long-enough",2_000),null);
});

test("만료된 세션과 짧은 비밀키를 거부한다",()=>{
  const token=createSignedSession(user,secret,1_000);
  assert.equal(readSignedSession(token,secret,604_801_000),null);
  assert.throws(()=>createSignedSession(user,"short"));
});
