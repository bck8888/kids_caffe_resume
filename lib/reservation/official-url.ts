const OFFICIAL_CALENDAR_URL = "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do";

export function buildOfficialCalendarUrl(facilityId:string,date:string) {
  if (!facilityId.trim()) throw new Error("시설 ID가 필요합니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("이용 날짜 형식이 올바르지 않습니다.");
  const params=new URLSearchParams({
    q_fcltyId:facilityId,
    q_year:date.slice(0,4),
    q_month:date.slice(5,7),
    q_fcltyStle:""
  });
  return `${OFFICIAL_CALENDAR_URL}?${params}`;
}
