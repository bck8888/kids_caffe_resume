const normalizeKey = (key) => key.normalize("NFKC").toLowerCase().replace(/[^a-z0-9ㄱ-힝]/g, "");

const RESERVATION_PERSONAL_KEYS = new Set([
  "childname", "childnm", "chilnm", "아동이름", "자녀이름",
  "birthyear", "childbirthyear", "출생년도", "생년",
  "birthmonth", "birthmm", "childbirthmonth", "출생월", "생월",
  "sex", "gender", "sexdstncode", "성별",
  "residence", "residencebranch", "suyn", "atdrccode", "insttcode", "brtccode", "qbsissfrnd",
  "거주지", "거주지분기", "자치구", "행정동",
  "guardiancount", "acmpnyprtctorco", "보호자수", "동반보호자수"
].map(normalizeKey));

const FORBIDDEN_EXACT_KEYS = new Set([
  "seoulcredential", "seoulcredentials", "seoulid", "seouluserid", "username",
  "password", "passwd", "pwd", "otp", "onetimepassword",
  "cookie", "cookies", "setcookie", "sessioncookie", "sessionid", "sessiontoken",
  "authtoken", "accesstoken", "refreshtoken", "bearertoken", "authorization",
  "residentregistrationnumber", "residentregistrationid", "rrn", "jumin", "juminno", "주민등록번호",
  "health", "healthdata", "medical", "medicaldata", "diagnosis", "disability", "건강정보", "장애정보",
  "fulldom", "domhtml", "innerhtml", "outerhtml", "rawhtml", "pagehtml",
  "screenshot", "screencapture", "screenimage", "스크린샷"
].map(normalizeKey));

export function classifySensitiveKey(key) {
  const normalized = normalizeKey(key);
  if (
    RESERVATION_PERSONAL_KEYS.has(normalized) ||
    normalized.endsWith("childname") ||
    normalized.endsWith("childnm") ||
    normalized.endsWith("chilnm") ||
    normalized.endsWith("birthyear") ||
    normalized.endsWith("birthmonth") ||
    normalized.endsWith("guardiancount")
  ) return "reservation_personal";
  if (
    FORBIDDEN_EXACT_KEYS.has(normalized) ||
    normalized.includes("password") ||
    normalized.includes("cookie") ||
    normalized.endsWith("authtoken") ||
    normalized.endsWith("accesstoken") ||
    normalized.endsWith("refreshtoken") ||
    normalized.includes("residentregistration") ||
    normalized.includes("screenshot") ||
    normalized.includes("disability") ||
    normalized.includes("diagnosis")
  ) return "forbidden";
  return null;
}

function walkKeys(value, visit, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walkKeys(child, visit, seen);
  }
}

export function assertNoSensitiveKeys(value, options = {}) {
  const allowReservationPersonal = options.allowReservationPersonal === true;
  walkKeys(value, (key) => {
    const classification = classifySensitiveKey(key);
    if (classification === "forbidden" || (classification === "reservation_personal" && !allowReservationPersonal)) {
      throw new TypeError(`Sensitive key is not allowed at this boundary: ${key}`);
    }
  });
}
