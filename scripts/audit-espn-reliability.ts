// Verify ESPN as a cross-check oracle across ALL finished WC matches.
// For each finished match compares three numbers:
//   A) ESPN scoreboard score
//   B) ESPN score re-derived from keyEvents goals (internal consistency)
//   C) Football-Data fullTime/regularTime score
// Flags: ESPN-internal mismatch (A≠B) and ESPN-vs-FD mismatch (A≠C).
//   npx tsx scripts/audit-espn-reliability.ts
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const SB = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const FD = env.FOOTBALL_DATA_TOKEN;

async function main() {
  // FD scores by abbreviation pair
  const fdJson: any = await (await fetch(`https://api.football-data.org/v4/competitions/WC/matches?season=2026`, { headers: { "X-Auth-Token": FD } })).json();
  const fdByPair = new Map<string, string>();
  for (const m of fdJson.matches || []) {
    if (m.status !== "FINISHED") continue;
    const h = m.score?.regularTime?.home ?? m.score?.fullTime?.home;
    const a = m.score?.regularTime?.away ?? m.score?.fullTime?.away;
    if (h == null || a == null) continue;
    fdByPair.set(`${m.homeTeam?.tla}|${m.awayTeam?.tla}`, `${h}-${a}`);
  }

  const board: any = await (await fetch(`${SB}/scoreboard?dates=20260611-20260719&limit=200`, { cache: "no-store" as any })).json();
  const finished = (board.events || []).filter((e: any) => e.competitions?.[0]?.status?.type?.state === "post");

  const internalMismatch: any[] = [];
  const espnVsFd: any[] = [];
  let checked = 0;

  for (const ev of finished) {
    const comp = ev.competitions[0];
    const home = comp.competitors.find((c: any) => c.homeAway === "home");
    const away = comp.competitors.find((c: any) => c.homeAway === "away");
    const hAbbr = home.team.abbreviation, aAbbr = away.team.abbreviation;
    const espnScore = `${home.score}-${away.score}`;

    // Re-derive from keyEvents
    const s: any = await (await fetch(`${SB}/summary?event=${ev.id}`, { cache: "no-store" as any })).json();
    let gh = 0, ga = 0;
    for (const k of s.keyEvents || []) {
      if (!/goal/i.test(k.type?.text || "") || k.shootout) continue;
      const tn = k.team?.displayName;
      if (tn === home.team.displayName) gh++;
      else if (tn === away.team.displayName) ga++;
    }
    const derived = `${gh}-${ga}`;
    checked++;
    if (derived !== espnScore) internalMismatch.push({ match: `${hAbbr}-${aAbbr}`, scoreboard: espnScore, fromGoals: derived });

    // vs FD (try both orientations of the pair)
    const fd = fdByPair.get(`${hAbbr}|${aAbbr}`) ?? (() => {
      const flipped = fdByPair.get(`${aAbbr}|${hAbbr}`);
      if (!flipped) return undefined;
      const [x, y] = flipped.split("-"); return `${y}-${x}`;
    })();
    if (fd && fd !== espnScore) espnVsFd.push({ match: `${hAbbr}-${aAbbr}`, espn: espnScore, fd });
  }

  console.log(`Checked ${checked} finished matches (ESPN), ${fdByPair.size} finished in FD.\n`);
  console.log(`ESPN INTERNAL inconsistency (scoreboard vs its own goal events): ${internalMismatch.length}`);
  for (const m of internalMismatch) console.log("  ", JSON.stringify(m));
  console.log(`\nESPN vs FOOTBALL-DATA disagreements: ${espnVsFd.length}`);
  for (const m of espnVsFd) console.log("  ", JSON.stringify(m));
}
main().catch((e) => { console.error(e); process.exit(1); });
