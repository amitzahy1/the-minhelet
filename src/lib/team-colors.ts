// ============================================================================
// WC2026 — Team Primary Colors for theming
// ============================================================================

export const TEAM_COLORS: Record<string, { primary: string; secondary: string; text: string }> = {
  // Group A
  MEX: { primary: "#006847", secondary: "#CE1126", text: "#FFFFFF" },
  KOR: { primary: "#CD2E3A", secondary: "#0047A0", text: "#FFFFFF" },
  CZE: { primary: "#11457E", secondary: "#D7141A", text: "#FFFFFF" },
  RSA: { primary: "#007749", secondary: "#FFB81C", text: "#FFFFFF" },
  // Group B
  CAN: { primary: "#FF0000", secondary: "#FFFFFF", text: "#FFFFFF" },
  QAT: { primary: "#8A1538", secondary: "#FFFFFF", text: "#FFFFFF" },
  SUI: { primary: "#FF0000", secondary: "#FFFFFF", text: "#FFFFFF" },
  BIH: { primary: "#002395", secondary: "#FECE00", text: "#FFFFFF" },
  // Group C
  BRA: { primary: "#009C3B", secondary: "#FFDF00", text: "#002776" },
  MAR: { primary: "#C1272D", secondary: "#006233", text: "#FFFFFF" },
  SCO: { primary: "#003399", secondary: "#FFFFFF", text: "#FFFFFF" },
  HAI: { primary: "#00209F", secondary: "#D21034", text: "#FFFFFF" },
  // Group D
  USA: { primary: "#002868", secondary: "#BF0A30", text: "#FFFFFF" },
  PAR: { primary: "#D52B1E", secondary: "#0038A8", text: "#FFFFFF" },
  TUR: { primary: "#E30A17", secondary: "#FFFFFF", text: "#FFFFFF" },
  AUS: { primary: "#00843D", secondary: "#FFCD00", text: "#002B5C" },
  // Group E
  GER: { primary: "#000000", secondary: "#FFFFFF", text: "#FFFFFF" },
  ECU: { primary: "#FFD100", secondary: "#034EA2", text: "#034EA2" },
  CIV: { primary: "#FF8200", secondary: "#009A44", text: "#FFFFFF" },
  CUR: { primary: "#002B7F", secondary: "#F9E814", text: "#FFFFFF" },
  // Group F
  NED: { primary: "#FF6600", secondary: "#FFFFFF", text: "#FFFFFF" },
  JPN: { primary: "#000080", secondary: "#BC002D", text: "#FFFFFF" },
  SWE: { primary: "#006AA7", secondary: "#FECC02", text: "#FECC02" },
  TUN: { primary: "#E70013", secondary: "#FFFFFF", text: "#FFFFFF" },
  // Group G
  BEL: { primary: "#ED2939", secondary: "#000000", text: "#FFFFFF" },
  IRN: { primary: "#239F40", secondary: "#DA0000", text: "#FFFFFF" },
  EGY: { primary: "#C8102E", secondary: "#000000", text: "#FFFFFF" },
  NZL: { primary: "#000000", secondary: "#FFFFFF", text: "#FFFFFF" },
  // Group H
  ESP: { primary: "#AA151B", secondary: "#F1BF00", text: "#FFFFFF" },
  URU: { primary: "#5CBFEB", secondary: "#FFFFFF", text: "#001489" },
  KSA: { primary: "#006C35", secondary: "#FFFFFF", text: "#FFFFFF" },
  CPV: { primary: "#003893", secondary: "#CF2027", text: "#FFFFFF" },
  // Group I
  FRA: { primary: "#002395", secondary: "#ED2939", text: "#FFFFFF" },
  SEN: { primary: "#00853F", secondary: "#FDEF42", text: "#FFFFFF" },
  NOR: { primary: "#EF2B2D", secondary: "#002868", text: "#FFFFFF" },
  IRQ: { primary: "#007A3D", secondary: "#FFFFFF", text: "#FFFFFF" },
  // Group J
  ARG: { primary: "#75AADB", secondary: "#FFFFFF", text: "#003087" },
  AUT: { primary: "#ED2939", secondary: "#FFFFFF", text: "#FFFFFF" },
  ALG: { primary: "#006233", secondary: "#FFFFFF", text: "#FFFFFF" },
  JOR: { primary: "#007A3D", secondary: "#CE1126", text: "#FFFFFF" },
  // Group K
  POR: { primary: "#006600", secondary: "#FF0000", text: "#FFFFFF" },
  COL: { primary: "#FCD116", secondary: "#003893", text: "#003893" },
  UZB: { primary: "#1EB53A", secondary: "#0099B5", text: "#FFFFFF" },
  COD: { primary: "#007FFF", secondary: "#CE1021", text: "#FFFFFF" },
  // Group L
  ENG: { primary: "#FFFFFF", secondary: "#CF081F", text: "#041E42" },
  CRO: { primary: "#FF0000", secondary: "#FFFFFF", text: "#FFFFFF" },
  GHA: { primary: "#006B3F", secondary: "#FCD116", text: "#FFFFFF" },
  PAN: { primary: "#DA121A", secondary: "#003DA5", text: "#FFFFFF" },
};

export function getTeamColor(code: string) {
  return TEAM_COLORS[code] || { primary: "#6B7280", secondary: "#E5E7EB", text: "#FFFFFF" };
}
