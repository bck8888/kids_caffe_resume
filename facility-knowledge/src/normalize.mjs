import { createHash } from "node:crypto";

export const PARSER_VERSION = "facility-knowledge/1.0.0";

const EQUIPMENT = [
  ["slide", "미끄럼틀", ["미끄럼틀", "슬라이드"], ["gross_motor"]],
  ["ball_pool", "볼풀", ["볼풀", "볼풀장", "볼풀놀이"], ["sensory", "gross_motor"]],
  ["trampoline", "트램펄린", ["트램펄린", "방방", "점핑"], ["gross_motor"]],
  ["climbing", "클라이밍", ["클라이밍", "암벽", "클라이밍월"], ["gross_motor"]],
  ["blocks", "블록", ["블록", "블럭", "레고"], ["constructive_play"]],
  ["role_play", "역할놀이", ["역할놀이", "소꿉놀이", "주방놀이"], ["pretend_play"]],
  ["sand_play", "모래놀이", ["모래놀이", "모래놀이터"], ["sensory"]],
  ["zipline", "짚라인", ["짚라인", "집라인"], ["gross_motor"]],
  ["net_play", "그물놀이", ["그물놀이", "네트놀이", "네트 놀이터"], ["gross_motor"]],
  ["water_play", "물놀이", ["물놀이", "워터플레이"], ["sensory"]],
  ["digital_play", "디지털놀이", ["디지털놀이", "미디어놀이", "인터랙티브"], ["digital_play"]],
  ["books", "책놀이", ["책놀이", "그림책", "독서공간"], ["quiet_play"]]
];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeSeoulFacility(row) {
  const value = (key) => row[key] == null ? "" : String(row[key]).trim();
  const number = (key) => {
    const parsed = Number(value(key));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    sourceFacilityId: value("FCLTY_ID"), canonicalName: value("FCLTY_NM"),
    districtCode: value("ATDRC_CODE"), districtName: value("ATDRC_NM"),
    institutionCode: value("INSTT_CODE"), institutionName: value("INSTT_NM"),
    postalCode: value("ZIP"), baseAddress: value("BASS_ADRES"), detailAddress: value("DETAIL_ADRES"),
    longitude: number("X_CRDNT_VALUE"), latitude: number("Y_CRDNT_VALUE"), contactText: value("CTTPC"),
    facilityTypeCode: value("SVC_CL_CODE"), facilityTypeName: value("SVC_CL_NM"), operatorName: value("INSTT_NM"),
    foundedOn: value("FOND_DE"), updatedAt: value("UPDT_DT"), registeredAt: value("REGIST_DT"),
    officialDetailUrl: `https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=${encodeURIComponent(value("FCLTY_ID"))}`,
    officialCalendarUrl: `https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=${encodeURIComponent(value("FCLTY_ID"))}`,
    assertions: {
      opening_days: value("OPEN_WEEK"), regular_closure: value("CLOSE_WEEK"), age_eligibility: value("POSBL_AGRDE"),
      fee_free_indicator: value("RNTFEE_FREE_AT"), institution_capacity: value("INSTT_PSNCPA"), individual_capacity: value("INDVDL_PSNCPA")
    },
    properties: { atdrcCodeArray: value("ATDRC_CODE_ARRAY") }
  };
}

export function decodeHtml(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

export function htmlToText(html) {
  return decodeHtml(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>|<\/li>|<\/tr>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function section(html, heading) {
  const pattern = new RegExp(`<h3[^>]*>\\s*${heading}\\s*</h3>([\\s\\S]*?)(?=<h3\\b|</div>\\s*</div>|$)`, "i");
  return htmlToText(html.match(pattern)?.[1] ?? "");
}

function labelledValue(html, label) {
  const pattern = new RegExp(`<li[^>]*>\\s*<b[^>]*>\\s*${label}\\s*</b>([\\s\\S]*?)</li>`, "i");
  return htmlToText(html.match(pattern)?.[1] ?? "");
}

function classifyLines(text) {
  const definitions = [
    ["age", /연령|세 이하|세 이상|년생/], ["residency", /서울시민|서울생활권|거주|재직|재학/],
    ["evidence", /증빙|서류|등본|재직증명|학생증/], ["child", /아동.*(?:명|인)|영유아.*(?:명|인)|자녀/],
    ["guardian", /보호자|인솔자|교사/], ["group", /단체|어린이집|유치원|기관/],
    ["frequency", /월.*회|이용.*회|주.*회/], ["duplicate", /중복|동일.*예약/], ["no_show", /노쇼/],
    ["waitlist", /대기(?:신청|예약|정원)/], ["care", /돌봄/], ["fee", /이용료|입장료|원\)|원\s|무료/],
    ["payment", /결제|카드|현금/], ["cancellation", /취소/], ["safety", /안전|사고|발열|질병|미끄럼방지/]
  ];
  const lines = text.split(/\n|(?<=[.!?])\s+/).map((line) => line.replace(/^[-*★※\s]+/, "").trim()).filter((line) => line.length >= 4);
  return definitions.flatMap(([type, pattern]) => lines.filter((line) => pattern.test(line)).map((sourceText) => ({ type, sourceText })));
}

export function normalizeUmppaDetail(html, baseUrl) {
  const fullText = htmlToText(html);
  const title = htmlToText(html.match(/<h2[^>]*class=["'][^"']*sub_title01[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const ageText = section(html, "이용연령") || section(html, "이용대상") || fullText.match(/\d+\s*~\s*\d+세[^\n]*/)?.[0] || "";
  const sections = {
    age: ageText, hours: section(html, "운영시간"), onlineReservation: section(html, "온라인 예약"),
    onsiteReservation: section(html, "현장 신청"), fee: section(html, "이용료"), rules: section(html, "이용규칙")
  };
  const knowledgeText = Object.values(sections).filter(Boolean).join("\n");
  const playZones = [...new Set([...knowledgeText.matchAll(/([가-힣A-Za-z0-9 ]{1,30}(?:놀이공간|놀이영역|놀이존|체험존))/g)].map((match) => match[1].trim()))]
    .map((sourceTerm) => ({ name: sourceTerm.replace(/\s+/g, " "), sourceTerm, targetAgeText: ageText }));
  const equipment = [];
  for (const [key, name, aliases, attributes] of EQUIPMENT) {
    for (const alias of aliases) {
      if (fullText.includes(alias)) equipment.push({ key, name, sourceTerm: alias, attributes, targetAgeText: ageText });
    }
  }
  const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi)]
    .map((match) => ({ url: new URL(match[1], baseUrl).href, alt: decodeHtml(match[2] ?? "") }))
    .filter((image) => /\/upload\/fcltyInfoManage\//.test(image.url));
  const sessions = [];
  const timePattern = /(\d{1,2}[:시]\s*\d{0,2})\s*(?:~|-|부터)\s*(\d{1,2}[:시]\s*\d{0,2})/g;
  for (const match of sections.hours.matchAll(timePattern)) sessions.push({ startTime: normalizeTime(match[1]), endTime: normalizeTime(match[2]), sourceText: match[0] });
  const featureDefs = [["accessibility", /장애|휠체어|엘리베이터/], ["parking", /주차/], ["transit", /지하철|버스|도보/], ["food", /음식|간식|취식/], ["socks", /양말/], ["safety_notice", /안전|주의|사고|질병|발열/]];
  const features = featureDefs.flatMap(([type, pattern]) => knowledgeText.split("\n").filter((line) => pattern.test(line)).map((sourceText) => ({ type, sourceText })));
  return {
    title, address: labelledValue(html, "주소"), contact: labelledValue(html, "연락처"), closedDays: labelledValue(html, "휴관일"),
    sections, rules: classifyLines(knowledgeText), features, equipment, sessions, images, playZones,
    programs: /프로그램/.test(knowledgeText) ? [{ type: "program", name: null, scheduleText: sections.onlineReservation }] : [],
    careObserved: /돌봄/.test(knowledgeText), waitlistObserved: /대기(?:신청|예약)/.test(knowledgeText)
  };
}

function normalizeTime(value) {
  const digits = value.replace("시", ":").replace(/\s/g, "").split(":");
  return `${String(Number(digits[0])).padStart(2, "0")}:${String(Number(digits[1] || 0)).padStart(2, "0")}`;
}

export function normalizeUmppaCalendar(html, year, month, observedAt) {
  const days = [];
  const cellPattern = /<td[^>]*title=["'](\d{1,2})일\s*(예약가능|예약불가)["'][^>]*>([\s\S]*?)<\/td>/gi;
  for (const match of html.matchAll(cellPattern)) {
    const day = Number(match[1]);
    const reason = htmlToText(match[3]).replace(new RegExp(`^${day}\\s*`), "").trim();
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ date, state: match[2] === "예약가능" ? "available" : "unavailable", reason: reason || null });
  }
  const expiresAt = new Date(new Date(observedAt).getTime() + 6 * 60 * 60 * 1000).toISOString();
  return {
    days: days.map((day) => ({ ...day, observedAt, expiresAt })),
    closures: days.filter((day) => day.reason).map((day) => ({ date: day.date, reason: day.reason, type: classifyClosure(day.reason) }))
  };
}

function classifyClosure(reason) {
  if (/보수|공사|점검/.test(reason)) return "maintenance";
  if (/방역|대청소/.test(reason)) return "temporary_closure";
  if (/기상|태풍|폭설|호우/.test(reason)) return "weather_closure";
  if (/프로그램|단체|행사/.test(reason)) return "program_or_group_only";
  if (/휴일|공휴일|명절|추석|설날/.test(reason)) return "holiday";
  return "source_stated_closure";
}
