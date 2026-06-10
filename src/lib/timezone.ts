// Israel timezone helpers — shared across schedule page, standings, etc.

export function toIsraelTimeShort(utcDate: string): string {
  return new Date(utcDate).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toIsraelDate(utcDate: string): string {
  return new Date(utcDate).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Short Israel date — "11.6" — for tight notices where the full weekday
 *  form doesn't fit but a time alone is ambiguous. */
export function toIsraelDateShort(utcDate: string): string {
  return new Date(utcDate).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
  });
}

/** Returns YYYY-MM-DD in Israel timezone for a given UTC date string */
export function toIsraelDateKey(utcDate: string): string {
  const d = new Date(utcDate);
  const parts = d.toLocaleString("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  return parts; // en-CA locale formats as YYYY-MM-DD
}

/** Returns today's date as YYYY-MM-DD in Israel timezone */
export function getTodayIsrael(): string {
  return toIsraelDateKey(new Date().toISOString());
}
