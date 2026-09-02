import type { ReservationIntent } from "../reservation/types";

const PROFILE_KEY = "seoul-kids-alpha-profile-v1";
export type LocalProfile = { favoriteFacilityIds:string[]; preferredEquipment:string[]; intent?:ReservationIntent };
const emptyProfile:LocalProfile={ favoriteFacilityIds:[], preferredEquipment:[] };

export function loadLocalProfile():LocalProfile {
  if (typeof window === "undefined") return emptyProfile;
  try {
    const value=JSON.parse(localStorage.getItem(PROFILE_KEY)??"null");
    if (!value || !Array.isArray(value.favoriteFacilityIds) || !Array.isArray(value.preferredEquipment)) return emptyProfile;
    return { ...value, favoriteFacilityIds:value.favoriteFacilityIds.slice(0,3) };
  } catch { return emptyProfile; }
}

export function saveLocalProfile(profile:LocalProfile) {
  if (profile.favoriteFacilityIds.length>3) throw new Error("자주 가는 시설은 최대 3개여야 합니다.");
  localStorage.setItem(PROFILE_KEY,JSON.stringify({ ...profile, favoriteFacilityIds:profile.favoriteFacilityIds.slice(0,3) }));
}
