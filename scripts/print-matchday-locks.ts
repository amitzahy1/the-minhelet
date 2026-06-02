// One-off: print, for each group-stage match-day, the FIRST match (which drives
// the lock), the LAST match of the day, and the Israel-time lock. Uses the SAME
// schedule source as the app (/api/matches → football-data.org) and the SAME
// logic (computeMatchDays: noon-IL day boundary, lock = first kickoff −30m).
//   npx tsx scripts/print-matchday-locks.ts
import { readFileSync } from "fs";
import { computeMatchDays } from "../src/lib/tournament/group-live-state";
import { toAppCode } from "../src/lib/fd-team-mapping";
import { getTeamByCode } from "../src/lib/tournament/groups";

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* ignore */ }
}

interface F { ms: number; group: string; homeTla: string; awayTla: string; homeName: string; awayName: string }

const heName = (tla: string, fallback: string) =>
  getTeamByCode(toAppCode(tla))?.name_he || fallback || tla || "?";
const whenIL = (ms: number) =>
  new Date(ms).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hmIL = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
const label = (m: F) => `${heName(m.homeTla, "")} – ${heName(m.awayTla, "")} (${m.group.replace("GROUP_", "בית ")})`;

async function main() {
  loadEnvLocal();
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) { console.error("Missing FOOTBALL_DATA_TOKEN in .env.local"); process.exit(1); }

  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
    headers: { "X-Auth-Token": token },
  });
  if (!res.ok) { console.error(`football-data API error ${res.status}`); process.exit(1); }
  const json = await res.json() as { matches?: Array<{ utcDate: string; group?: string; stage?: string; status?: string; homeTeam?: { tla?: string; shortName?: string; name?: string }; awayTeam?: { tla?: string; shortName?: string; name?: string } }> };
  const raw = json.matches || [];

  const fixtures: F[] = raw
    .filter((m) => (m.stage || "").toUpperCase().includes("GROUP"))
    .map((m) => ({
      ms: new Date(m.utcDate).getTime(),
      group: m.group || "",
      homeTla: m.homeTeam?.tla || "",
      awayTla: m.awayTeam?.tla || "",
      homeName: m.homeTeam?.shortName || m.homeTeam?.name || "",
      awayName: m.awayTeam?.shortName || m.awayTeam?.name || "",
    }));

  const days = computeMatchDays(fixtures.map((f) => ({ date: new Date(f.ms).toISOString(), group: f.group, stage: "GROUP_STAGE" })));
  console.log(`Source: football-data.org WC 2026 — ${fixtures.length} group-stage matches → ${days.length} match-days\n`);

  days.forEach((d, i) => {
    const first = new Date(d.firstKickoffISO).getTime();
    const last = new Date(d.lastKickoffISO).getTime();
    const inDay = fixtures.filter((f) => f.ms >= first && f.ms <= last).sort((a, b) => a.ms - b.ms);
    const firstMatch = inDay[0];
    const lastMatches = inDay.filter((f) => f.ms === last); // ties = simultaneous kickoffs

    console.log(`מחזור ${i + 1}  (${inDay.length} משחקים)`);
    console.log(`  🔒 נעילה:        ${hmIL(d.lockAtISO)}  (שעון ישראל)`);
    console.log(`  ▶️ משחק ראשון:   ${label(firstMatch)}  —  ${whenIL(firstMatch.ms)}`);
    lastMatches.forEach((lm, k) =>
      console.log(`  🏁 משחק אחרון${lastMatches.length > 1 ? ` (${k + 1}/${lastMatches.length})` : ""}:  ${label(lm)}  —  ${whenIL(lm.ms)}`));
    console.log("");
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
