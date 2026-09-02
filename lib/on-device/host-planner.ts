import { type OnDeviceAction, type OnDeviceReservationIntent, validateOnDeviceReservationIntent } from "./assistant-protocol.ts";
import { decideSafeAction, type ScreenDecision, type ScreenObservation } from "./screen-adapter.ts";

const OFFICIAL_ORIGIN="https://umppa.seoul.go.kr";

function stop(reason:string):ScreenDecision {
  return {state:"unknown",confidence:0,action:{type:"stop",requiresUserConfirmation:true,reason},adapterVersion:"on-device-rules-v1"};
}

export function planMobileHostAction(observation:ScreenObservation,intent:unknown,now=new Date()):ScreenDecision {
  if(!validateOnDeviceReservationIntent(intent,now))return stop("예약 정보가 만료되었거나 올바르지 않아 중단합니다.");

  try {
    if(new URL(observation.url).origin!==OFFICIAL_ORIGIN)return stop("서울시 공식 페이지가 아니므로 중단합니다.");
  } catch {
    return stop("페이지 주소를 확인할 수 없어 중단합니다.");
  }

  const safeIntent=intent as OnDeviceReservationIntent;
  const decision=decideSafeAction(observation,{
    date:safeIntent.reservation.date,
    slotId:safeIntent.reservation.selectedSlot.id
  });
  const actionType=decision.action.type as OnDeviceAction;
  return safeIntent.allowedActions.includes(actionType)
    ? decision
    : stop("허용되지 않은 동작이 요청되어 중단합니다.");
}
