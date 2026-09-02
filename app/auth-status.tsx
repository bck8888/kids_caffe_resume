"use client";
import { useEffect, useState } from "react";

type AuthState={configured:boolean;authenticated:boolean;user:{id:string;nickname:string}|null};
export default function AuthStatus(){
  const [state,setState]=useState<AuthState|null>(null);
  useEffect(()=>{fetch("/api/auth/session").then(response=>response.json()).then(setState).catch(()=>setState({configured:false,authenticated:false,user:null}));},[]);
  async function logout(){await fetch("/api/auth/session",{method:"DELETE"});location.reload();}
  if(!state)return <p className="auth-status">로그인 상태 확인 중…</p>;
  if(state.authenticated)return <div className="auth-row"><span><b>{state.user?.nickname}</b>님으로 연결됨</span><button type="button" onClick={logout}>로그아웃</button></div>;
  return <div className="auth-block"><a className={`kakao-login ${state.configured?"":"disabled"}`} href={state.configured?"/api/auth/kakao/start":"#"} aria-disabled={!state.configured}>카카오로 시작하기</a>{!state.configured&&<small>알파 환경에 카카오 REST 키와 세션 시크릿을 설정하면 활성화됩니다.</small>}</div>;
}
