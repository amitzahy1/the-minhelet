/**
 * Fix wrong team IDs by searching API-Football
 * Run: npx tsx scripts/fix-team-ids.ts
 */

const API_KEY = "bf9c9c08ac73c3896876105278ea7a2c";
const API_HOST = "v3.football.api-sports.io";

// Teams that had wrong data — need correct IDs
const TEAMS_TO_FIX: Record<string, string> = {
  ALG: "Algeria", BIH: "Bosnia", CAN: "Canada", CIV: "Ivory Coast",
  GER: "Germany", GHA: "Ghana", KSA: "Saudi Arabia", NED: "Netherlands",
  NOR: "Norway", PAN: "Panama", SWE: "Sweden", TUN: "Tunisia", USA: "USA",
  HAI: "Haiti", IRQ: "Iraq", JOR: "Jordan", UZB: "Uzbekistan",
  COD: "DR Congo", CUR: "Curacao", CPV: "Cape Verde", RSA: "South Africa",
};

async function searchTeam(name: string): Promise<{ id: number; name: string; country: string }[]> {
  const url = `https://${API_HOST}/teams?search=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const data = await res.json();
  return (data.response || [])
    .filter((t: { team: { national: boolean } }) => t.team.national)
    .map((t: { team: { id: number; name: string; country: string } }) => ({
      id: t.team.id,
      name: t.team.name,
      country: t.team.country,
    }));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("🔍 Searching for correct team IDs...\n");

  for (const [code, searchName] of Object.entries(TEAMS_TO_FIX)) {
    const results = await searchTeam(searchName);
    const senior = results.filter(r =>
      !r.name.includes("W") && !r.name.includes("U17") &&
      !r.name.includes("U19") && !r.name.includes("U20") &&
      !r.name.includes("U21") && !r.name.includes("U23")
    );

    if (senior.length > 0) {
      console.log(`${code}: ${senior[0].id} — ${senior[0].name} (${senior[0].country})`);
    } else if (results.length > 0) {
      console.log(`${code}: ${results[0].id} — ${results[0].name} (UNCERTAIN)`);
    } else {
      console.log(`${code}: NOT FOUND for "${searchName}"`);
    }

    await sleep(7000); // Rate limit: 10/min
  }
}

main().catch(console.error);
