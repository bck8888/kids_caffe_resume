import type { ReservationAction, ReservationSlot } from "./types";

export type SlotRelation = "contains_selected_time" | "next_available" | "following_available";
export type CandidateSlot<T extends ReservationSlot = ReservationSlot> = {
  slot: T;
  relation: SlotRelation;
};

function toMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : Number.NaN;
}

export function selectCandidateSlotChoices<T extends ReservationSlot>(slots: T[], selectedTime: string): CandidateSlot<T>[] {
  const target = toMinutes(selectedTime);
  if (!Number.isFinite(target)) return [];

  const available = slots
    .filter(slot => slot.remaining > 0 && Number.isFinite(toMinutes(slot.startTime)) && Number.isFinite(toMinutes(slot.endTime)))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const containingIndex = available.findIndex(slot => toMinutes(slot.startTime) <= target && target < toMinutes(slot.endTime));

  if (containingIndex >= 0) {
    return available.slice(containingIndex, containingIndex + 2).map((slot, index) => ({
      slot,
      relation: index === 0 ? "contains_selected_time" : "next_available"
    }));
  }

  const nextIndex = available.findIndex(slot => toMinutes(slot.startTime) >= target);
  return nextIndex < 0
    ? []
    : available.slice(nextIndex, nextIndex + 2).map((slot, index) => ({
        slot,
        relation: index === 0 ? "next_available" : "following_available"
      }));
}

export function selectCandidateSlots<T extends ReservationSlot>(slots: T[], selectedTime: string): T[] {
  return selectCandidateSlotChoices(slots, selectedTime).map(choice => choice.slot);
}

export function planReservationAction(slots: ReservationSlot[], selectedTime: string, selectedSlotId?: string): ReservationAction {
  if (selectedSlotId) {
    const selected = slots.find(slot => slot.id === selectedSlotId && slot.remaining > 0);
    return selected
      ? { type: "open_official_page", slotId: selected.id, requiresUserConfirmation: true, reason: "사용자가 선택한 회차를 공식 페이지에서 최종 확인합니다." }
      : { type: "ask_user", requiresUserConfirmation: true, reason: "선택한 회차가 없거나 매진되어 다시 선택해야 합니다." };
  }
  const candidates = selectCandidateSlots(slots, selectedTime);
  return candidates.length
    ? { type: "show_slots", slotIds: candidates.map(slot => slot.id), requiresUserConfirmation: true, reason: "입력한 이용 시간과 가까운 예약 가능 회차입니다." }
    : { type: "ask_user", requiresUserConfirmation: true, reason: "입력한 이용 시간 이후 예약 가능한 회차가 없습니다." };
}
