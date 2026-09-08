import type { ReservationSlot } from "../reservation/types";

export const ON_DEVICE_INTENT_KEY = "seoul-kids-on-device-intent-v1";
export const ON_DEVICE_ACTIONS = [
  "dismiss_known_notice",
  "request_seoul_login",
  "select_date",
  "select_slot",
  "fill_approved_fields",
  "highlight_final_submit",
  "submit_reservation",
  "record_user_confirmed_result",
  "stop"
] as const;

export type OnDeviceAction = typeof ON_DEVICE_ACTIONS[number];

export type OnDeviceReservationIntent = {
  schemaVersion: "on-device-intent-v1";
  runtimeTarget: "mobile_on_device";
  createdAt: string;
  expiresAt: string;
  reservation: {
    facilityId: string;
    facilityName: string;
    date: string;
    selectedTime: string;
    selectedSlot: Pick<ReservationSlot,"id"|"startTime"|"endTime">;
  };
  allowedActions: OnDeviceAction[];
};

const DEFAULT_ACTIONS: OnDeviceAction[] = [
  "dismiss_known_notice",
  "request_seoul_login",
  "select_date",
  "select_slot",
  "fill_approved_fields",
  "highlight_final_submit",
  "record_user_confirmed_result",
  "stop"
];

const clockMinutes=(value:string|undefined)=>{
  const match=/^(\d{2}):(\d{2})$/.exec(value??"");
  if(!match)return Number.NaN;
  const hour=Number(match[1]),minute=Number(match[2]);
  return hour<=23&&minute<=59?hour*60+minute:Number.NaN;
};

export function createOnDeviceReservationIntent(input:{
  facilityId:string;
  facilityName:string;
  date:string;
  selectedTime:string;
  selectedSlot:Pick<ReservationSlot,"id"|"startTime"|"endTime">;
},now=new Date()):OnDeviceReservationIntent {
  return {
    schemaVersion:"on-device-intent-v1",
    runtimeTarget:"mobile_on_device",
    createdAt:now.toISOString(),
    expiresAt:new Date(now.getTime()+60*60*1000).toISOString(),
    reservation:{...input},
    allowedActions:[...DEFAULT_ACTIONS]
  };
}

export function validateOnDeviceReservationIntent(value:unknown,now=new Date()):value is OnDeviceReservationIntent {
  if (!value || typeof value!=="object") return false;
  const intent=value as Partial<OnDeviceReservationIntent>;
  const reservation=intent.reservation as Partial<OnDeviceReservationIntent["reservation"]>|undefined;
  const slot=reservation?.selectedSlot as Partial<OnDeviceReservationIntent["reservation"]["selectedSlot"]>|undefined;
  if (intent.schemaVersion!=="on-device-intent-v1" || intent.runtimeTarget!=="mobile_on_device") return false;
  const createdAt=Date.parse(intent.createdAt??"");
  const expiresAt=Date.parse(intent.expiresAt??"");
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt<=now.getTime() || expiresAt<=createdAt) return false;
  if (!reservation || !/^[A-Z0-9]{2,32}$/i.test(reservation.facilityId??"") || !reservation.facilityName?.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reservation.date??"") || !Number.isFinite(clockMinutes(reservation.selectedTime))) return false;
  const slotStart=clockMinutes(slot?.startTime),slotEnd=clockMinutes(slot?.endTime);
  if (!slot?.id || !Number.isFinite(slotStart) || !Number.isFinite(slotEnd) || slotStart>=slotEnd) return false;
  if (!Array.isArray(intent.allowedActions) || intent.allowedActions.some(action=>!ON_DEVICE_ACTIONS.includes(action as OnDeviceAction))) return false;
  return intent.allowedActions.includes("stop");
}
