import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kakaoCallbackUrl } from "@/lib/auth/app-url";

export async function GET(request:NextRequest) {
  const clientId=process.env.KAKAO_REST_API_KEY;
  if(!clientId) return NextResponse.redirect(new URL("/?authError=kakao_not_configured",request.url));
  const state=randomBytes(24).toString("base64url");
  const redirectUri=kakaoCallbackUrl(request.nextUrl.origin,process.env.NEXT_PUBLIC_APP_URL);
  const params=new URLSearchParams({ client_id:clientId, redirect_uri:redirectUri, response_type:"code", state });
  const response=NextResponse.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
  response.cookies.set("kakao_oauth_state",state,{ httpOnly:true, secure:request.nextUrl.protocol==="https:", sameSite:"lax", maxAge:600, path:"/" });
  return response;
}
