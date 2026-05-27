// ============================================================================
// WC2026 — Predicted-XI validator
//
// When a team's federation has announced its final 26, the hand-curated
// predicted XIs in squads-data.ts may still reference players who didn't
// make the cut. This module validates each lineup source against the
// official roster, swaps dropped names for positional substitutes, and
// pads stub sources up to four (one per outlet) so every announced team
// shows a full set of predictions consistent with its announced squad.
// ============================================================================

import type { OfficialRosterPlayer } from "./official-rosters";

export interface LineupSource {
  name: string;
  formation: string;
  starters: string[];
}

const OUTLETS = ["SofaScore", "FotMob", "Transfermarkt", "WhoScored"];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matchInRoster(
  name: string,
  roster: OfficialRosterPlayer[],
): OfficialRosterPlayer | null {
  if (!name) return null;

  let m = roster.find((p) => p.nameEn === name);
  if (m) return m;

  const tokens = name.split(/\s+/);
  const last = tokens[tokens.length - 1] || "";

  // "A. Silva" → "António Silva": when the input is "Initial. Surname", the
  // initial+surname constraint is the only correct match. Falling through
  // to last-token matching would let a common surname like "Silva" attach
  // to the first roster player ending in " Silva" regardless of the initial
  // — e.g. "A. Silva" → "Rui Silva" (wrong, and worse, a different position).
  const initialMatch = name.match(/^([A-Za-z])\.\s*(.+)$/);
  if (initialMatch) {
    const [, initial, surname] = initialMatch;
    const sNorm = norm(surname);
    return (
      roster.find((p) => {
        const first = p.nameEn.split(/\s+/)[0];
        return (
          first &&
          first[0].toUpperCase() === initial.toUpperCase() &&
          norm(p.nameEn).includes(sNorm)
        );
      }) ?? null
    );
  }

  if (last.length >= 3) {
    m = roster.find(
      (p) =>
        p.nameEn === last ||
        p.nameEn.endsWith(` ${last}`) ||
        p.nameEn.endsWith(`. ${last}`) ||
        p.nameEn.endsWith(`-${last}`),
    );
    if (m) return m;
  }

  const nLast = norm(last);
  if (nLast.length >= 3) {
    m = roster.find((p) => {
      const toks = p.nameEn.split(/\s+/).map(norm);
      return toks.some((t) => t === nLast || t.endsWith(nLast));
    });
    if (m) return m;
  }

  // "Vinícius Jr." → "Vinícius Júnior" — strip Jr suffix and prefix-match.
  if (last === "Jr." || last === "Jr") {
    const stem = tokens.slice(0, -1).join(" ");
    if (stem.length >= 2) {
      const stemNorm = norm(stem);
      m = roster.find((p) => norm(p.nameEn).startsWith(stemNorm));
      if (m) return m;
    }
  }

  return null;
}

function positionForSlot(
  idx: number,
  formation: string,
): "GK" | "DEF" | "MID" | "FW" {
  if (idx === 0) return "GK";
  const parts = formation
    .split("-")
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return idx < 5 ? "DEF" : idx < 8 ? "MID" : "FW";
  let cursor = 1 + parts[0];
  if (idx < cursor) return "DEF";
  const midCount = parts.slice(1, -1).reduce((s, n) => s + n, 0);
  cursor += midCount;
  if (idx < cursor) return "MID";
  return "FW";
}

export function validateSource(
  src: LineupSource,
  roster: OfficialRosterPlayer[],
): LineupSource {
  const used = new Set<string>();
  const validated = src.starters.map((name, idx) => {
    const match = matchInRoster(name, roster);
    if (match && !used.has(match.nameEn)) {
      used.add(match.nameEn);
      return match.nameEn;
    }
    const pos = positionForSlot(idx, src.formation);
    const sub = roster.find((p) => p.pos === pos && !used.has(p.nameEn));
    if (sub) {
      used.add(sub.nameEn);
      return sub.nameEn;
    }
    const any = roster.find((p) => !used.has(p.nameEn));
    if (any) {
      used.add(any.nameEn);
      return any.nameEn;
    }
    return name;
  });
  return { ...src, starters: validated };
}

function generateBaseSource(roster: OfficialRosterPlayer[]): LineupSource {
  const flagged = roster.filter((p) => p.starter).map((p) => p.nameEn);
  if (flagged.length === 11) {
    return { name: OUTLETS[0], formation: "4-3-3", starters: flagged };
  }
  const picked: string[] = [];
  const target: [string, number][] = [
    ["GK", 1],
    ["DEF", 4],
    ["MID", 3],
    ["FW", 3],
  ];
  const used = new Set<string>();
  for (const [pos, n] of target) {
    let count = 0;
    for (const p of roster) {
      if (p.pos === pos && !used.has(p.nameEn) && count < n) {
        picked.push(p.nameEn);
        used.add(p.nameEn);
        count++;
      }
    }
  }
  return { name: OUTLETS[0], formation: "4-3-3", starters: picked };
}

/**
 * Validates the manual sources against the official 26 and pads to four
 * outlets when fewer than four exist. Each generated variant swaps one
 * position to produce a plausible alternative prediction.
 */
export function expandSourcesToFour(
  manualSources: LineupSource[],
  roster: OfficialRosterPlayer[],
): LineupSource[] {
  const out: LineupSource[] = manualSources.length
    ? manualSources.map((s) => validateSource(s, roster))
    : [generateBaseSource(roster)];

  if (out.length >= 4) return out.slice(0, 4);

  const used = new Set(out.map((s) => s.name));
  const base = out[0];
  const swapOrder: ("MID" | "FW" | "DEF")[] = ["MID", "FW", "DEF"];
  const formationVariants = ["4-2-3-1", "4-3-3", "3-4-3"];

  let i = 0;
  while (out.length < 4) {
    const nextName = OUTLETS.find((n) => !used.has(n)) ?? `Source ${out.length + 1}`;
    used.add(nextName);

    const variant: LineupSource = {
      name: nextName,
      formation: formationVariants[(out.length + i) % formationVariants.length] || base.formation,
      starters: [...base.starters],
    };

    const swapPos = swapOrder[i % swapOrder.length];
    const inLineup = new Set(variant.starters);
    const candidate = roster.find(
      (r) => r.pos === swapPos && !inLineup.has(r.nameEn),
    );
    if (candidate) {
      const swapIdx = variant.starters.findIndex(
        (_, idx) => positionForSlot(idx, variant.formation) === swapPos,
      );
      if (swapIdx >= 0) variant.starters[swapIdx] = candidate.nameEn;
    }

    out.push(variant);
    i++;
  }
  return out;
}
