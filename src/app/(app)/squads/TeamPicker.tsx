"use client";

// ============================================================================
// TeamPicker — custom dropdown for the /squads page team selector.
// Replaces the native <select> because it rendered the ✅ emoji at OS-default
// size (huge + colorful blob). With a custom listbox we control icon size
// and can use small refined lucide badges instead of emoji. Includes a
// sort toggle: alphabetical (Hebrew) or by squad value (descending).
// ============================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { BadgeCheckIcon, ShieldCheckIcon, ChevronDown, ArrowUpDown } from "lucide-react";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { isFifaConfirmed, isOfficiallyAnnounced } from "@/lib/tournament/official-squads";
import { OFFICIAL_ROSTERS } from "@/lib/tournament/official-rosters";
import { getMarketValue } from "@/lib/tournament/market-values";
import { getSquad } from "@/lib/tournament/squads-data";
import type { Team } from "@/types";

function computeSquadValue(code: string): number {
  const roster = OFFICIAL_ROSTERS[code] || [];
  const players = roster.length ? roster : getSquad(code)?.players || [];
  let total = 0;
  for (const p of players) {
    const v = getMarketValue(p.nameEn);
    if (v !== null) total += v;
  }
  return Math.round(total * 10) / 10;
}

interface Props {
  selected: string;
  teams: Team[];
  onSelect: (code: string) => void;
}

function StatusBadge({ code }: { code: string }) {
  if (isFifaConfirmed(code)) {
    return (
      <span title="סגל מאושר על-ידי FIFA" className="inline-flex items-center gap-0.5 text-amber-600">
        <ShieldCheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
        <span className="text-[10px] font-bold tracking-tight">FIFA</span>
      </span>
    );
  }
  if (isOfficiallyAnnounced(code)) {
    return (
      <span title="סגל רשמי שפורסם על-ידי ההתאחדות" className="inline-flex items-center gap-0.5 text-emerald-600">
        <BadgeCheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
        <span className="text-[10px] font-bold tracking-tight">רשמי</span>
      </span>
    );
  }
  return null;
}

type SortMode = "alpha" | "value";

export function TeamPicker({ selected, teams, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("value");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute squad values once per dropdown open. Memo by `teams` identity.
  const valuesByCode = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of teams) out[t.code] = computeSquadValue(t.code);
    return out;
  }, [teams]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus the search box on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selectedTeam = teams.find((t) => t.code === selected);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? teams.filter((t) => t.code.toLowerCase().includes(q) || t.name_he.includes(q) || t.name.toLowerCase().includes(q))
    : teams;
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "alpha") {
      arr.sort((a, b) => a.name_he.localeCompare(b.name_he, "he"));
    } else {
      arr.sort((a, b) => (valuesByCode[b.code] ?? 0) - (valuesByCode[a.code] ?? 0));
    }
    return arr;
  }, [filtered, sortMode, valuesByCode]);

  return (
    <div ref={containerRef} className="relative w-full sm:w-80" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold shadow-sm hover:border-gray-300 transition-colors flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedTeam ? (
            <>
              <TeamLogo code={selectedTeam.code} size="sm" />
              <span className="truncate text-gray-900">{selectedTeam.name_he}</span>
              <span className="text-[10px] text-gray-400 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{selectedTeam.code}</span>
              <StatusBadge code={selectedTeam.code} />
            </>
          ) : (
            <span className="text-gray-500">בחרו נבחרת...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full right-0 left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש נבחרת..."
              className="flex-1 px-2 py-1 text-xs bg-transparent focus:outline-none placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === "alpha" ? "value" : "alpha"))}
              title={sortMode === "alpha" ? "כעת: א-ב · החליפו ל-שווי" : "כעת: שווי · החליפו ל-א-ב"}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-600 rounded-md bg-white border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortMode === "alpha" ? "א-ב" : "שווי"}
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {sorted.map((t) => (
              <li key={t.code}>
                <button
                  type="button"
                  onClick={() => { onSelect(t.code); setOpen(false); setQuery(""); }}
                  className={`w-full px-3 py-2 flex items-center gap-2.5 text-sm text-start transition-colors ${
                    t.code === selected ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50"
                  }`}
                >
                  <TeamLogo code={t.code} size="sm" />
                  <span className="flex-1 truncate font-bold">{t.name_he}</span>
                  <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{t.code}</span>
                  <StatusBadge code={t.code} />
                </button>
              </li>
            ))}
            {sorted.length === 0 && (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">אין התאמות</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
