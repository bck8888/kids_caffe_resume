import assert from "node:assert/strict";

const url = new URL("https://umppa.seoul.go.kr/icare/user/kidsCafeResve/ND_selectResveTmeList.do");
url.search = new URLSearchParams({ q_fcltyId: "SC240404", q_resveDe: "2026-08-16", q_dayNo: "1" });

const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
assert.equal(response.ok, true, `HTTP ${response.status}`);
const payload = await response.json();
assert.equal(payload.result, true, "result must be true");
assert.ok(Array.isArray(payload.value?.tmeData), "value.tmeData must be an array");
assert.ok(payload.value.tmeData.length > 0, "at least one reservation slot is required");

const requiredFields = ["fcltyId", "tmeSn", "useBeginTime", "useEndTime", "resvePsncpa", "resveNmpr"];
for (const field of requiredFields) assert.ok(field in payload.value.tmeData[0], `missing field: ${field}`);

console.log(`Reservation API OK: ${payload.value.tmeData.length} slots`);
