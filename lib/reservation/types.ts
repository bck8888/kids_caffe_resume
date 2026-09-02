export type ReservationSlot = {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remaining: number;
  cancellationDeadline: string;
};

export type ReservationIntent = {
  facilityId: string;
  facilityName: string;
  date: string;
  desiredTime: string;
  selectedSlotId?: string;
  updatedAt: string;
};

export type ReservationAction =
  | { type: "show_slots"; slotIds: string[]; requiresUserConfirmation: true; reason: string }
  | { type: "open_official_page"; slotId: string; requiresUserConfirmation: true; reason: string }
  | { type: "ask_user"; requiresUserConfirmation: true; reason: string };
