export function normalizeClockTime(value:string){
  const compact=value.trim().replace(":","");
  if(!/^\d{3,4}$/.test(compact)) return value.trim();
  const padded=compact.padStart(4,"0");
  const hour=Number(padded.slice(0,2)),minute=Number(padded.slice(2));
  return hour<=23&&minute<=59?`${padded.slice(0,2)}:${padded.slice(2)}`:value.trim();
}
