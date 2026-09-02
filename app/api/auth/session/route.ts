import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request:NextRequest) {
  const configured=Boolean(process.env.KAKAO_REST_API_KEY && process.env.APP_SESSION_SECRET && process.env.APP_SESSION_SECRET.length>=32);
  const user=readSession(request.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ configured, authenticated:Boolean(user), user:user?{id:user.id,nickname:user.nickname}:null });
}

export async function DELETE(request:NextRequest) {
  const response=NextResponse.json({ok:true});
  response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,secure:request.nextUrl.protocol==="https:",sameSite:"lax",expires:new Date(0),path:"/"});
  return response;
}
