"use client";

import { useState } from "react";

export default function TestResetClient() {
  const [clearing,setClearing]=useState(false);

  async function clearTestState() {
    setClearing(true);
    localStorage.removeItem("seoul-kids-alpha-profile-v1");
    localStorage.removeItem("kids-cafe-visits");
    await fetch("/api/auth/session",{method:"DELETE"});
    location.replace("/");
  }

  return <main className="test-reset-page">
    <section>
      <p className="eyebrow">개발 테스트</p>
      <h1>처음 상태로 시작하기</h1>
      <p className="summary">이 서비스의 로그인 정보, 자주 가는 곳, 예약 조건과 저장한 후보만 삭제합니다.</p>
      <button type="button" onClick={clearTestState} disabled={clearing}>{clearing?"삭제 중…":"테스트 정보 삭제하고 시작"}</button>
    </section>
  </main>;
}
