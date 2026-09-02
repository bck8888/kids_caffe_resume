import type { EdgeAction, ReservationSlot } from "./types";

function toMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : Number.NaN;
}

export function selectCandidateSlots<T extends ReservationSlot>(slots: T[], desiredTime: string): T[] {
  const desired = toMinutes(desiredTime);
  if (!Number.isFinite(desired)) return [];
  const available = slots
    .filter(slot => slot.remaining > 0 && Number.isFinite(toMinutes(slot.startTime)) && Number.isFinite(toMinutes(slot.endTime)))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const containing = available.findIndex(slot => toMinutes(slot.startTime) <= desired && desired < toMinutes(slot.endTime));
  const upcoming = available.findIndex(slot => toMinutes(slot.startTime) >= desired);
  const start = containing >= 0 ? containing : upcoming;
  return start >= 0 ? available.slice(start, start + 2) : [];
}

export function planReservationAction(slots: ReservationSlot[], desiredTime: string, selectedSlotId?: string): EdgeAction {
  if (selectedSlotId) {
    const selected = slots.find(slot => slot.id === selectedSlotId && slot.remaining > 0);
    return selected
      ? { type: "open_official_page", slotId: selected.id, requiresUserConfirmation: true, reason: "사용자가 선택한 회차를 공식 페이지에서 최종 확인합니다." }
      : { type: "ask_user", requiresUserConfirmation: true, reason: "선택한 회차가 없거나 매진되어 다시 선택해야 합니다." };
  }
  const candidates = selectCandidateSlots(slots, desiredTime);
  return candidates.length
    ? { type: "show_slots", slotIds: candidates.map(slot => slot.id), requiresUserConfirmation: true, reason: "희망 시각을 포함한 회차와 다음 이용 가능한 회차입니다." }
    : { type: "ask_user", requiresUserConfirmation: true, reason: "희망 시각 이후 예약 가능한 회차가 없습니다." };
}
