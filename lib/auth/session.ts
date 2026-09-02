import "server-only";
import { createSignedSession, readSignedSession } from "./session-token";
export type { ServiceUser } from "./session-token";

export const SESSION_COOKIE = "seoul_kids_session";
function secret() { const value=process.env.APP_SESSION_SECRET; if(!value || value.length<32) return null; return value; }

export function createSession(user:{id:string;nickname:string;provider:"kakao"}) {
  const key=secret(); if(!key) throw new Error("APP_SESSION_SECRET must contain at least 32 characters.");
  return createSignedSession(user,key);
}

export function readSession(token?:string) { return readSignedSession(token,secret()??undefined); }
