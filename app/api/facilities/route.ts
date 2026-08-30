import { NextResponse } from "next/server";

const SERVICE_NAME = "tnFcltySttusInfo1011";

type SeoulRow = Record<string, unknown>;

function textValue(row: SeoulRow, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const match = entries.find(([key]) => key.toLowerCase() === alias.toLowerCase());
    if (match && match[1] !== null && match[1] !== undefined) return String(match[1]);
  }
  return "";
}

function normalize(row: SeoulRow, index: number) {
  return {
    id: textValue(row, ["FCLTY_ID", "FCLTYID", "fcltyId", "FCLTYIDNTFR", "ID"]) || `facility-${index}`,
    name: textValue(row, ["FCLTY_NM", "FCLTYNM", "fcltyNm", "FACLT_NM", "FCLTYNAME", "NAME"]),
    district: textValue(row, ["SIGNGU_NM", "SIGNGU", "GU_NM", "S_DISTRICT", "SIGUNGU"]),
    address: textValue(row, ["BASS_ADRES", "ROAD_NM_ADDR", "ROAD_ADDR", "ADDRESS", "ADDR", "ADRES"]),
    latitude: textValue(row, ["LA", "LAT", "LATITUDE", "Y", "FCLTY_LA"]),
    longitude: textValue(row, ["LO", "LON", "LONGITUDE", "X", "FCLTY_LO"]),
    age: textValue(row, ["USE_AGE", "USE_AGE_NM", "UTILIIZA_AGE", "AGE"]),
    phone: textValue(row, ["TELNO", "TEL_NO", "PHONE", "CTTPC"]),
    operatingDays: textValue(row, ["OPER_DAY", "OPER_DE", "OPERATING_DAY", "WORKDAY"]),
    closedDays: textValue(row, ["RGLR_HOLIDAY", "CLSE_DAY", "CLOSED_DAY", "HOLIDAY"])
  };
}

export async function GET() {
  const apiKey = process.env.SEOUL_OPEN_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "서울시 Open API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/${SERVICE_NAME}/1/1000/`;

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`서울시 API 응답 오류: ${response.status}`);

    const payload = await response.json();
    const service = payload[SERVICE_NAME];

    if (!service || !Array.isArray(service.row)) {
      const message = service?.RESULT?.MESSAGE ?? payload?.RESULT?.MESSAGE ?? "시설 데이터 형식을 확인할 수 없습니다.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const facilities = service.row
      .map(normalize)
      .filter((facility: ReturnType<typeof normalize>) => facility.name || facility.address);

    return NextResponse.json({
      total: service.list_total_count ?? facilities.length,
      facilities,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "시설정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
