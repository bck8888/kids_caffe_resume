import { NextRequest, NextResponse } from "next/server";
import { alphaSlots } from "@/lib/alpha/fixtures";
import { normalizeClockTime } from "@/lib/reservation/normalize";

type ReservationRow = Record<string, unknown>;
const value = (row: ReservationRow, key: string) => Object.entries(row).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase())?.[1];
const stringValue = (row: ReservationRow, key: string) => { const raw = value(row, key); return raw == null ? "" : String(raw); };
const numberValue = (row: ReservationRow, key: string) => { const parsed = Number(value(row, key)); return Number.isFinite(parsed) ? parsed : 0; };

export async function GET(request: NextRequest) {
  const facilityId = request.nextUrl.searchParams.get("facilityId")?.trim();
  const date = request.nextUrl.searchParams.get("date")?.trim();
  if (!facilityId || !/^[A-Z0-9]{2,32}$/i.test(facilityId)) return NextResponse.json({ error: "유효한 시설 ID가 필요합니다." }, { status: 400 });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "YYYY-MM-DD 형식의 날짜가 필요합니다." }, { status: 400 });
  if (process.env.ALPHA_USE_FIXTURES === "true" && facilityId.startsWith("SCALPHA")) return NextResponse.json({facilityId,date,slots:alphaSlots(facilityId,date),source:"synthetic-alpha-fixture"});

  const dayNo = new Date(`${date}T00:00:00+09:00`).getDay() + 1;
  const params = new URLSearchParams({ q_fcltyId: facilityId, q_resveDe: date, q_dayNo: String(dayNo) });
  const endpoint = `https://umppa.seoul.go.kr/icare/user/kidsCafeResve/ND_selectResveTmeList.do?${params}`;
  try {
    const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: "application/json", "User-Agent": "kids-cafe-finder/0.1" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`예약정보 응답 오류: ${response.status}`);
    const payload = await response.json();
    const rows: ReservationRow[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.value?.tmeData)
        ? payload.value.tmeData
        : Array.isArray(payload?.list)
          ? payload.list
          : Array.isArray(payload?.resultList)
            ? payload.resultList
            : [];
    const slots = rows.map((row, index) => {
      const capacity = numberValue(row, "resvePsncpa");
      const reserved = numberValue(row, "resveNmpr");
      return {
        id: stringValue(row, "tmeSn") || `${facilityId}-${date}-${index}`,
        type: stringValue(row, "tmeSeNm"), startTime: normalizeClockTime(stringValue(row, "useBeginTime")), endTime: normalizeClockTime(stringValue(row, "useEndTime")),
        capacity, reserved, remaining: Math.max(capacity - reserved, 0),
        waitingCapacity: numberValue(row, "waitPsncpa"), waiting: numberValue(row, "waitNmpr"),
        cancellationDeadline: stringValue(row, "canclPosblDe"), careAvailable: stringValue(row, "dolbomSvcAt") === "Y",
        careCapacity: numberValue(row, "dolbomPsncpa"), careReserved: numberValue(row, "dolbomNmpr"), program: stringValue(row, "progrmData")
      };
    });
    return NextResponse.json({ facilityId, date, slots, source: "umppa-public-endpoint" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "예약정보를 불러오지 못했습니다." }, { status: 502 });
  }
}
