// ============================================================================
// WC2026 — Centralized team flag emojis
// Import this instead of duplicating flag maps in every file
// ============================================================================

export const FLAGS: Record<string, string> = {
  MEX: "🇲🇽", KOR: "🇰🇷", CZE: "🇨🇿", RSA: "🇿🇦",
  CAN: "🇨🇦", QAT: "🇶🇦", SUI: "🇨🇭", BIH: "🇧🇦",
  BRA: "🇧🇷", MAR: "🇲🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", HAI: "🇭🇹",
  USA: "🇺🇸", PAR: "🇵🇾", TUR: "🇹🇷", AUS: "🇦🇺",
  GER: "🇩🇪", ECU: "🇪🇨", CIV: "🇨🇮", CUR: "🇨🇼",
  NED: "🇳🇱", JPN: "🇯🇵", SWE: "🇸🇪", TUN: "🇹🇳",
  BEL: "🇧🇪", IRN: "🇮🇷", EGY: "🇪🇬", NZL: "🇳🇿",
  ESP: "🇪🇸", URU: "🇺🇾", KSA: "🇸🇦", CPV: "🇨🇻",
  FRA: "🇫🇷", SEN: "🇸🇳", NOR: "🇳🇴", IRQ: "🇮🇶",
  ARG: "🇦🇷", AUT: "🇦🇹", ALG: "🇩🇿", JOR: "🇯🇴",
  POR: "🇵🇹", COL: "🇨🇴", UZB: "🇺🇿", COD: "🇨🇩",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", CRO: "🇭🇷", GHA: "🇬🇭", PAN: "🇵🇦",
};

export function getFlag(code: string): string {
  return FLAGS[code] || "🏳️";
}

// Hebrew team names
export const TEAM_NAMES_HE: Record<string, string> = {
  MEX: "מקסיקו", KOR: "דרום קוריאה", CZE: "צ׳כיה", RSA: "דרום אפריקה",
  CAN: "קנדה", QAT: "קטאר", SUI: "שווייץ", BIH: "בוסניה",
  BRA: "ברזיל", MAR: "מרוקו", SCO: "סקוטלנד", HAI: "האיטי",
  USA: "ארה״ב", PAR: "פרגוואי", TUR: "טורקיה", AUS: "אוסטרליה",
  GER: "גרמניה", ECU: "אקוודור", CIV: "חוף השנהב", CUR: "קוראסאו",
  NED: "הולנד", JPN: "יפן", SWE: "שוודיה", TUN: "תוניסיה",
  BEL: "בלגיה", IRN: "איראן", EGY: "מצרים", NZL: "ניו זילנד",
  ESP: "ספרד", URU: "אורוגוואי", KSA: "סעודיה", CPV: "כף ורדה",
  FRA: "צרפת", SEN: "סנגל", NOR: "נורבגיה", IRQ: "עיראק",
  ARG: "ארגנטינה", AUT: "אוסטריה", ALG: "אלג׳יריה", JOR: "ירדן",
  POR: "פורטוגל", COL: "קולומביה", UZB: "אוזבקיסטן", COD: "קונגו",
  ENG: "אנגליה", CRO: "קרואטיה", GHA: "גאנה", PAN: "פנמה",
};

export function getTeamNameHe(code: string): string {
  return TEAM_NAMES_HE[code] || code;
}
