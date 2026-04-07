// ============================================================================
// WC2026 — Tournament Groups & Teams Data
// Source: Football-Data.org API — Official FIFA World Cup 2026 Draw
// Last updated: April 2026
// ============================================================================

import type { Team } from "@/types";

export const GROUPS: Record<string, Team[]> = {
  A: [
    { id: 769, name: "Mexico", name_he: "מקסיקו", code: "MEX", flag_url: "/flags/mex.svg", group_id: "A", fifa_ranking: 15 },
    { id: 772, name: "South Korea", name_he: "דרום קוריאה", code: "KOR", flag_url: "/flags/kor.svg", group_id: "A", fifa_ranking: 25 },
    { id: 798, name: "Czechia", name_he: "צ׳כיה", code: "CZE", flag_url: "/flags/cze.svg", group_id: "A", fifa_ranking: 41 },
    { id: 774, name: "South Africa", name_he: "דרום אפריקה", code: "RSA", flag_url: "/flags/rsa.svg", group_id: "A", fifa_ranking: 60 },
  ],
  B: [
    { id: 828, name: "Canada", name_he: "קנדה", code: "CAN", flag_url: "/flags/can.svg", group_id: "B", fifa_ranking: 30 },
    { id: 8030, name: "Qatar", name_he: "קטאר", code: "QAT", flag_url: "/flags/qat.svg", group_id: "B", fifa_ranking: 55 },
    { id: 788, name: "Switzerland", name_he: "שווייץ", code: "SUI", flag_url: "/flags/sui.svg", group_id: "B", fifa_ranking: 19 },
    { id: 1060, name: "Bosnia-Herzegovina", name_he: "בוסניה", code: "BIH", flag_url: "/flags/bih.svg", group_id: "B", fifa_ranking: 65 },
  ],
  C: [
    { id: 764, name: "Brazil", name_he: "ברזיל", code: "BRA", flag_url: "/flags/bra.svg", group_id: "C", fifa_ranking: 6 },
    { id: 815, name: "Morocco", name_he: "מרוקו", code: "MAR", flag_url: "/flags/mar.svg", group_id: "C", fifa_ranking: 8 },
    { id: 8873, name: "Scotland", name_he: "סקוטלנד", code: "SCO", flag_url: "/flags/sco.svg", group_id: "C", fifa_ranking: 43 },
    { id: 836, name: "Haiti", name_he: "האיטי", code: "HAI", flag_url: "/flags/hai.svg", group_id: "C", fifa_ranking: 83 },
  ],
  D: [
    { id: 771, name: "United States", name_he: "ארה״ב", code: "USA", flag_url: "/flags/usa.svg", group_id: "D", fifa_ranking: 16 },
    { id: 761, name: "Paraguay", name_he: "פרגוואי", code: "PAR", flag_url: "/flags/par.svg", group_id: "D", fifa_ranking: 40 },
    { id: 803, name: "Turkey", name_he: "טורקיה", code: "TUR", flag_url: "/flags/tur.svg", group_id: "D", fifa_ranking: 22 },
    { id: 779, name: "Australia", name_he: "אוסטרליה", code: "AUS", flag_url: "/flags/aus.svg", group_id: "D", fifa_ranking: 27 },
  ],
  E: [
    { id: 759, name: "Germany", name_he: "גרמניה", code: "GER", flag_url: "/flags/ger.svg", group_id: "E", fifa_ranking: 10 },
    { id: 791, name: "Ecuador", name_he: "אקוודור", code: "ECU", flag_url: "/flags/ecu.svg", group_id: "E", fifa_ranking: 23 },
    { id: 1935, name: "Ivory Coast", name_he: "חוף השנהב", code: "CIV", flag_url: "/flags/civ.svg", group_id: "E", fifa_ranking: 34 },
    { id: 9460, name: "Curaçao", name_he: "קוראסאו", code: "CUR", flag_url: "/flags/cur.svg", group_id: "E", fifa_ranking: 82 },
  ],
  F: [
    { id: 8601, name: "Netherlands", name_he: "הולנד", code: "NED", flag_url: "/flags/ned.svg", group_id: "F", fifa_ranking: 7 },
    { id: 766, name: "Japan", name_he: "יפן", code: "JPN", flag_url: "/flags/jpn.svg", group_id: "F", fifa_ranking: 18 },
    { id: 792, name: "Sweden", name_he: "שבדיה", code: "SWE", flag_url: "/flags/swe.svg", group_id: "F", fifa_ranking: 38 },
    { id: 802, name: "Tunisia", name_he: "תוניסיה", code: "TUN", flag_url: "/flags/tun.svg", group_id: "F", fifa_ranking: 44 },
  ],
  G: [
    { id: 805, name: "Belgium", name_he: "בלגיה", code: "BEL", flag_url: "/flags/bel.svg", group_id: "G", fifa_ranking: 9 },
    { id: 840, name: "Iran", name_he: "איראן", code: "IRN", flag_url: "/flags/irn.svg", group_id: "G", fifa_ranking: 21 },
    { id: 825, name: "Egypt", name_he: "מצרים", code: "EGY", flag_url: "/flags/egy.svg", group_id: "G", fifa_ranking: 29 },
    { id: 783, name: "New Zealand", name_he: "ניו זילנד", code: "NZL", flag_url: "/flags/nzl.svg", group_id: "G", fifa_ranking: 85 },
  ],
  H: [
    { id: 760, name: "Spain", name_he: "ספרד", code: "ESP", flag_url: "/flags/esp.svg", group_id: "H", fifa_ranking: 2 },
    { id: 758, name: "Uruguay", name_he: "אורוגוואי", code: "URU", flag_url: "/flags/uru.svg", group_id: "H", fifa_ranking: 17 },
    { id: 801, name: "Saudi Arabia", name_he: "ערב הסעודית", code: "KSA", flag_url: "/flags/ksa.svg", group_id: "H", fifa_ranking: 61 },
    { id: 1930, name: "Cape Verde", name_he: "כף ורדה", code: "CPV", flag_url: "/flags/cpv.svg", group_id: "H", fifa_ranking: 69 },
  ],
  I: [
    { id: 773, name: "France", name_he: "צרפת", code: "FRA", flag_url: "/flags/fra.svg", group_id: "I", fifa_ranking: 1 },
    { id: 804, name: "Senegal", name_he: "סנגל", code: "SEN", flag_url: "/flags/sen.svg", group_id: "I", fifa_ranking: 14 },
    { id: 8872, name: "Norway", name_he: "נורבגיה", code: "NOR", flag_url: "/flags/nor.svg", group_id: "I", fifa_ranking: 31 },
    { id: 8062, name: "Iraq", name_he: "עיראק", code: "IRQ", flag_url: "/flags/irq.svg", group_id: "I", fifa_ranking: 57 },
  ],
  J: [
    { id: 762, name: "Argentina", name_he: "ארגנטינה", code: "ARG", flag_url: "/flags/arg.svg", group_id: "J", fifa_ranking: 3 },
    { id: 816, name: "Austria", name_he: "אוסטריה", code: "AUT", flag_url: "/flags/aut.svg", group_id: "J", fifa_ranking: 24 },
    { id: 778, name: "Algeria", name_he: "אלג׳יריה", code: "ALG", flag_url: "/flags/alg.svg", group_id: "J", fifa_ranking: 28 },
    { id: 8049, name: "Jordan", name_he: "ירדן", code: "JOR", flag_url: "/flags/jor.svg", group_id: "J", fifa_ranking: 63 },
  ],
  K: [
    { id: 765, name: "Portugal", name_he: "פורטוגל", code: "POR", flag_url: "/flags/por.svg", group_id: "K", fifa_ranking: 5 },
    { id: 818, name: "Colombia", name_he: "קולומביה", code: "COL", flag_url: "/flags/col.svg", group_id: "K", fifa_ranking: 13 },
    { id: 8070, name: "Uzbekistan", name_he: "אוזבקיסטן", code: "UZB", flag_url: "/flags/uzb.svg", group_id: "K", fifa_ranking: 50 },
    { id: 1934, name: "Congo DR", name_he: "קונגו", code: "COD", flag_url: "/flags/cod.svg", group_id: "K", fifa_ranking: 46 },
  ],
  L: [
    { id: 770, name: "England", name_he: "אנגליה", code: "ENG", flag_url: "/flags/eng.svg", group_id: "L", fifa_ranking: 4 },
    { id: 799, name: "Croatia", name_he: "קרואטיה", code: "CRO", flag_url: "/flags/cro.svg", group_id: "L", fifa_ranking: 11 },
    { id: 763, name: "Ghana", name_he: "גאנה", code: "GHA", flag_url: "/flags/gha.svg", group_id: "L", fifa_ranking: 74 },
    { id: 1836, name: "Panama", name_he: "פנמה", code: "PAN", flag_url: "/flags/pan.svg", group_id: "L", fifa_ranking: 33 },
  ],
};

export const ALL_TEAMS: Team[] = Object.values(GROUPS).flat();

export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export function getTeamByCode(code: string): Team | undefined {
  return ALL_TEAMS.find((t) => t.code === code);
}

export function getGroupTeams(groupId: string): Team[] {
  return GROUPS[groupId] || [];
}
