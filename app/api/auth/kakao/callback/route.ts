import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { kakaoCallbackUrl, resolveAppOrigin } from "@/lib/auth/app-url";

export async function GET(request:NextRequest) {
  const code=request.nextUrl.searchParams.get("code"), state=request.nextUrl.searchParams.get("state"), savedState=request.cookies.get("kakao_oauth_state")?.value;
  const appOrigin=resolveAppOrigin(request.nextUrl.origin,process.env.NEXT_PUBLIC_APP_URL);
  const fail=(reason:string)=>{const response=NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(reason)}`,appOrigin));response.cookies.delete("kakao_oauth_state");return response;};
  if(!code || !state || !savedState || state!==savedState) return fail("invalid_oauth_state");
  const clientId=process.env.KAKAO_REST_API_KEY; if(!clientId) return fail("kakao_not_configured");
  const redirectUri=kakaoCallbackUrl(request.nextUrl.origin,process.env.NEXT_PUBLIC_APP_URL);
  const body=new URLSearchParams({ grant_type:"authorization_code", client_id:clientId, redirect_uri:redirectUri, code });
  if(process.env.KAKAO_CLIENT_SECRET) body.set("client_secret",process.env.KAKAO_CLIENT_SECRET);
  try {
    const tokenResponse=await fetch("https://kauth.kakao.com/oauth/token",{ method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store" });
    if(!tokenResponse.ok) return fail("token_exchange_failed");
    const token=await tokenResponse.json() as { access_token?:string }; if(!token.access_token) return fail("token_missing");
    const userResponse=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${token.access_token}`},cache:"no-store"});
    if(!userResponse.ok) return fail("profile_fetch_failed");
    const profile=await userResponse.json() as { id:number|string; properties?:{nickname?:string}; kakao_account?:{profile?:{nickname?:string}} };
    const nickname=profile.properties?.nickname??profile.kakao_account?.profile?.nickname??"카카오 사용자";
    const response=NextResponse.redirect(new URL("/?login=success",appOrigin));
    response.cookies.set(SESSION_COOKIE,createSession({id:`kakao:${profile.id}`,nickname,provider:"kakao"}),{httpOnly:true,secure:request.nextUrl.protocol==="https:",sameSite:"lax",maxAge:60*60*24*7,path:"/"});
    response.cookies.delete("kakao_oauth_state"); return response;
  } catch { return fail("oauth_request_failed"); }
}
