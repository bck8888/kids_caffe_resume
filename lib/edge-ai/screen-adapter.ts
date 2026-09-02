export type ScreenState="notice_popup"|"login_required"|"calendar"|"slot_selection"|"applicant_form"|"review"|"complete"|"unknown";
export type ScreenObservation={url:string;visibleText:string;controls:string[]};
export type SafeScreenAction=
  | {type:"dismiss_known_notice";requiresUserConfirmation:false}
  | {type:"request_seoul_login";requiresUserConfirmation:true}
  | {type:"select_date";value:string;requiresUserConfirmation:false}
  | {type:"select_slot";value:string;requiresUserConfirmation:false}
  | {type:"fill_allowed_fields";fields:string[];requiresUserConfirmation:true}
  | {type:"highlight_final_submit";requiresUserConfirmation:true}
  | {type:"record_confirmation";requiresUserConfirmation:true}
  | {type:"stop";requiresUserConfirmation:true;reason:string};

export type ScreenDecision={state:ScreenState;confidence:number;action:SafeScreenAction;adapterVersion:"screen-rules-v1"};
export type ScreenIntent={date:string;slotId?:string;allowedFields?:string[]};

const includesAny=(value:string,candidates:string[])=>candidates.some(candidate=>value.includes(candidate));

export function classifyScreen(observation:ScreenObservation):{state:ScreenState;confidence:number}{
  const text=observation.visibleText.replace(/\s+/g," ").trim();
  const controls=observation.controls.join(" ");
  if(includesAny(text,["예약이 완료","신청이 완료","예약완료"])) return {state:"complete",confidence:.98};
  if(includesAny(text,["최종 확인","신청 내용 확인"])&&includesAny(controls,["신청","예약하기"])) return {state:"review",confidence:.94};
  if(includesAny(text,["신청자 정보","이용자 정보"])&&includesAny(controls,["연락처","보호자"])) return {state:"applicant_form",confidence:.91};
  if(includesAny(text,["회차 선택","예약 회차","잔여"])&&includesAny(controls,["회차","시간"])) return {state:"slot_selection",confidence:.92};
  if(includesAny(text,["날짜 선택","예약일","달력"])&&includesAny(controls,["이전 달","다음 달","날짜"])) return {state:"calendar",confidence:.9};
  if(includesAny(text,["통합로그인","로그인이 필요","로그인 후 이용"])) return {state:"login_required",confidence:.96};
  if(includesAny(text,["공지사항","안내사항"])&&includesAny(controls,["닫기","오늘 하루 보지 않기"])) return {state:"notice_popup",confidence:.88};
  return {state:"unknown",confidence:0};
}

export function decideSafeAction(observation:ScreenObservation,intent:ScreenIntent):ScreenDecision{
  const classified=classifyScreen(observation);
  let action:SafeScreenAction;
  switch(classified.state){
    case "notice_popup": action={type:"dismiss_known_notice",requiresUserConfirmation:false}; break;
    case "login_required": action={type:"request_seoul_login",requiresUserConfirmation:true}; break;
    case "calendar": action=intent.date?{type:"select_date",value:intent.date,requiresUserConfirmation:false}:{type:"stop",requiresUserConfirmation:true,reason:"예약 날짜가 없습니다."}; break;
    case "slot_selection": action=intent.slotId?{type:"select_slot",value:intent.slotId,requiresUserConfirmation:false}:{type:"stop",requiresUserConfirmation:true,reason:"사용자가 선택한 회차가 없습니다."}; break;
    case "applicant_form": action=intent.allowedFields?.length?{type:"fill_allowed_fields",fields:intent.allowedFields,requiresUserConfirmation:true}:{type:"stop",requiresUserConfirmation:true,reason:"자동 입력이 허용된 항목이 없습니다."}; break;
    case "review": action={type:"highlight_final_submit",requiresUserConfirmation:true}; break;
    case "complete": action={type:"record_confirmation",requiresUserConfirmation:true}; break;
    default: action={type:"stop",requiresUserConfirmation:true,reason:"알 수 없는 화면에서는 어떤 동작도 실행하지 않습니다."};
  }
  return {...classified,action,adapterVersion:"screen-rules-v1"};
}
