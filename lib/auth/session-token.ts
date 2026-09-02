import { createHmac, timingSafeEqual } from "node:crypto";

export type ServiceUser = { id:string; nickname:string; provider:"kakao"; expiresAt:number };

function sign(value:string,key:string) {
  return createHmac("sha256",key).update(value).digest("base64url");
}

export function createSignedSession(user:Omit<ServiceUser,"expiresAt">,key:string,now=Date.now()) {
  if(key.length<32) throw new Error("APP_SESSION_SECRET must contain at least 32 characters.");
  const payload=Buffer.from(JSON.stringify({ ...user, expiresAt:now+1000*60*60*24*7 })).toString("base64url");
  return `${payload}.${sign(payload,key)}`;
}

export function readSignedSession(token:string|undefined,key:string|undefined,now=Date.now()):ServiceUser|null {
  if(!key || key.length<32 || !token) return null;
  const [payload,signature]=token.split(".");
  if(!payload || !signature) return null;
  const expected=sign(payload,key);
  if(signature.length!==expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
  try {
    const user=JSON.parse(Buffer.from(payload,"base64url").toString()) as ServiceUser;
    return user.expiresAt>now ? user : null;
  } catch {
    return null;
  }
}
