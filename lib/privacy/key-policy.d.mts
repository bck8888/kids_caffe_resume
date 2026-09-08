export type SensitiveKeyClass = "reservation_personal" | "forbidden";

export function classifySensitiveKey(key: string): SensitiveKeyClass | null;
export function assertNoSensitiveKeys(
  value: unknown,
  options?: { allowReservationPersonal?: boolean }
): void;
