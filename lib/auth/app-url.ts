export function resolveAppOrigin(requestOrigin:string,configuredUrl?:string) {
  const candidate=configuredUrl?.trim() || requestOrigin;
  const url=new URL(candidate);
  if(url.protocol!=="http:" && url.protocol!=="https:") throw new Error("NEXT_PUBLIC_APP_URL must use http or https.");
  return url.origin;
}

export function kakaoCallbackUrl(requestOrigin:string,configuredUrl?:string) {
  return new URL("/api/auth/kakao/callback",resolveAppOrigin(requestOrigin,configuredUrl)).toString();
}
