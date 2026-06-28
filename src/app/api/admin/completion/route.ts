import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import {
  resolveKnockoutTree,
  computeGroupOrders,
  KO_SLOT_KEYS,
  type ScheduleMatch,
  type KoSlotKey,
} from "@/lib/scoring/knockout-resolver";
import { slotStatus } from "@/lib/tournament/ko-live-state";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";
import type { FinishedMatch } from "@/lib/results-hits";

const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

// Real-data tree stages (fills one stage at a time) — order + Hebrew label.
const KO_STAGE_ORDER = ["r32", "r16", "qf", "sf", "final"] as const;
const KO_STAGE_LABEL: Record<string, string> = {
  r32: "שלב 32 הגדולות", r16: "שמינית הגמר", qf: "רבע גמר", sf: "חצי גמר", final: "הגמר",
};
const koStageOf = (key: string): string =>
  key.startsWith("r32") ? "r32" : key.startsWith("r16") ? "r16" : key.startsWith("qf") ? "qf" : key.startsWith("sf") ? "sf" : "final";

export async function GET(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ users: [], error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ users: [], error: "Missing config" });

  const supabase = createClient(url, serviceKey);

  // Load ALL profiles so every registered user appears (even without bets)
  const { data: allProfiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name");

  if (pErr) {
    return NextResponse.json({ users: [], error: `profiles: ${pErr.message}` });
  }

  // Load all brackets (service role bypasses RLS)
  const { data: brackets } = await supabase
    .from("user_brackets")
    .select("user_id, league_id, group_predictions, knockout_tree, knockout_tree_live, champion");

  // Load all special bets
  const { data: specials } = await supabase
    .from("special_bets")
    .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under");

  // Load all advancement picks
  const { data: advancements } = await supabase
    .from("advancement_picks")
    .select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner");

  // Load user emails
  const { data: authData } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users || []) {
    emailMap[u.id] = u.email || "";
  }

  const results = [];

  for (const profile of allProfiles || []) {
    const name = profile.display_name || "ללא שם";
    const email = emailMap[profile.id] || "";

    // Find this user's data
    const b = brackets?.find(br => br.user_id === profile.id);
    const sb = specials?.find(s => s.user_id === profile.id);
    const adv = advancements?.find(a => a.user_id === profile.id);

    // Count completed groups (6 scores each)
    let completedGroups = 0;
    if (b) {
      const gp = (b.group_predictions || {}) as Record<string, { scores: { home: number | null; away: number | null }[] }>;
      for (const letter of GROUP_LETTERS) {
        const group = gp[letter];
        if (group?.scores) {
          const filled = group.scores.filter((s: { home: number | null; away: number | null }) => s.home !== null && s.away !== null).length;
          if (filled === 6) completedGroups++;
        }
      }
    }

    // Count knockout matches with winner
    let knockoutFilled = 0;
    if (b) {
      const ko = (b.knockout_tree || {}) as Record<string, { winner: string | null }>;
      knockoutFilled = Object.values(ko).filter(m => m?.winner).length;
    }

    // Count filled special bets + advancement picks (total expected: 25)
    // special_bets: 7 fields + matchup_pick split into 3 + penalties = 10
    // advancement_picks: advanceToQF(8) + advanceToSF(4) + advanceToFinal(2) + winner(1) = 15
    let specialsFilled = 0;
    if (sb) {
      if (sb.top_scorer_player) specialsFilled++;
      if (sb.top_assists_player) specialsFilled++;
      if (sb.best_attack_team) specialsFilled++;
      if (sb.most_prolific_group) specialsFilled++;
      if (sb.driest_group) specialsFilled++;
      if (sb.dirtiest_team) specialsFilled++;
      if (sb.matchup_pick) {
        specialsFilled += sb.matchup_pick.split(",").filter(Boolean).length; // up to 3
      }
    }
    if (adv) {
      specialsFilled += ((adv.advance_to_qf as string[]) || []).filter(Boolean).length;   // up to 8
      specialsFilled += ((adv.advance_to_sf as string[]) || []).filter(Boolean).length;    // up to 4
      specialsFilled += ((adv.advance_to_final as string[]) || []).filter(Boolean).length; // up to 2
      if (adv.winner) specialsFilled++; // 1
    }

    const totalItems = 12 + 31 + 24;
    const filledItems = completedGroups + knockoutFilled + specialsFilled;
    const totalPct = Math.round((filledItems / totalItems) * 100);

    results.push({ name, email, groups: completedGroups, knockout: knockoutFilled, specials: specialsFilled, totalPct });
  }

  results.sort((a, b) => a.totalPct - b.totalPct);

  // ----- Real-data tree (עץ נתוני אמת): per-stage completion of OPEN matches -----
  // Reuses the SAME resolver + slotStatus the client nudge uses, over the live
  // fixtures from /api/matches, so the admin sees exactly who still has open
  // knockout matches to bet on (per stage) and can ping them.
  let koLive: { open: boolean; stages: { stage: string; label: string; openCount: number; users: { name: string; email: string; filled: number }[] }[] } | null = null;
  try {
    const origin = new URL(req.url).origin;
    const fxRes = await fetch(`${origin}/api/matches`, { cache: "no-store" });
    const fxJson = await fxRes.json();
    type Fx = { id: number; date: string; homeTla: string; awayTla: string; group?: string; stage?: string; status?: string | null; homeGoals?: number | null; awayGoals?: number | null; homePenalties?: number | null; awayPenalties?: number | null; winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null };
    const fixtures: Fx[] = fxJson.matches || [];
    const scored: FinishedMatch[] = fixtures
      .filter((m) => m.homeGoals != null && m.awayGoals != null)
      .map((m) => ({ id: m.id, date: m.date, homeTla: m.homeTla, awayTla: m.awayTla, group: m.group ?? "", stage: m.stage ?? "", homeGoals: m.homeGoals as number, awayGoals: m.awayGoals as number, homePenalties: m.homePenalties ?? null, awayPenalties: m.awayPenalties ?? null, winner: m.winner ?? null }));
    const schedule: ScheduleMatch[] = fixtures.map((m) => ({ homeTla: m.homeTla, awayTla: m.awayTla, date: m.date, status: m.status ?? null }));
    const groupStageComplete = Object.keys(computeGroupOrders(scored)).length === 12;
    if (groupStageComplete) {
      const tree = resolveKnockoutTree(scored, null, undefined, LIVE_FEEDERS);
      const now = Date.now();
      const openByStage: Record<string, string[]> = {};
      for (const k of KO_SLOT_KEYS as readonly KoSlotKey[]) {
        if (slotStatus(k, tree, schedule, now) === "open") {
          const st = koStageOf(k);
          (openByStage[st] = openByStage[st] || []).push(k);
        }
      }
      const stages = [];
      for (const st of KO_STAGE_ORDER) {
        const open = openByStage[st];
        if (!open || open.length === 0) continue;
        const usersArr = (allProfiles || []).map((profile) => {
          const b = brackets?.find((br) => br.user_id === profile.id);
          const kl = (b?.knockout_tree_live || {}) as Record<string, { winner: string | null }>;
          const filled = open.filter((k) => kl[k]?.winner).length;
          return { name: profile.display_name || "ללא שם", email: emailMap[profile.id] || "", filled };
        }).sort((a, b) => a.filled - b.filled);
        stages.push({ stage: st, label: KO_STAGE_LABEL[st], openCount: open.length, users: usersArr });
      }
      koLive = { open: stages.length > 0, stages };
    } else {
      koLive = { open: false, stages: [] };
    }
  } catch {
    koLive = null;
  }

  return NextResponse.json({ users: results, koLive });
}
