"use client";

// ============================================================================
// PlayerSelect — team-scoped player picker with squad autocomplete.
//
// Shared by the bettor special-bets page and the admin results-entry screen so
// both pick from the exact same canonical squad list (getSquadPlayers). This is
// what keeps the admin-entered top-scorer/assists name matching the names
// bettors chose — a free-text mismatch would silently zero out everyone's
// special-bet points.
// ============================================================================

import { getSquadPlayers } from "@/lib/tournament/squad-players";

export function PlayerSelect({
  team,
  value,
  onChange,
  label,
}: {
  team: string;
  value: string;
  onChange: (v: string) => void;
  /** Optional — omit when the caller supplies its own label/wrapper. */
  label?: string;
}) {
  const players = team ? getSquadPlayers(team) : [];
  const hasSquad = players.length > 0;
  const listId = `players-${team}`;
  // Only flag an invalid pick when (a) we actually have a squad, (b) the user
  // has typed something, and (c) it's not an exact match (datalist lookup is
  // case-sensitive — normalize lightly to catch accidents).
  const normalize = (s: string) => s.trim().toLowerCase();
  const invalid =
    hasSquad && value.trim().length > 0 && !players.some((p) => normalize(p) === normalize(value));
  return (
    <div className="space-y-1.5">
      {label ? <label className="text-sm font-semibold text-gray-700">{label}</label> : null}
      {!team ? (
        <div className="px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 font-medium">בחרו קודם נבחרת</div>
      ) : (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            list={hasSquad ? listId : undefined}
            placeholder={hasSquad ? "בחרו או הקלידו שם שחקן..." : "הקלידו שם שחקן..."}
            dir="ltr"
            className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium focus:outline-none focus:ring-2 ${
              invalid ? "border-amber-400 focus:ring-amber-500" : "border-gray-200 focus:ring-blue-500"
            }`}
          />
          {hasSquad && (
            <datalist id={listId}>
              {players.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          )}
          {invalid && (
            <p className="text-[11px] text-amber-700 font-medium">⚠ השם שהוזן לא ברשימת הסגל — ודאו שכתבתם נכון</p>
          )}
          {!hasSquad && (
            <p className="text-[11px] text-gray-400">הסגל לנבחרת הזו עוד לא עודכן — הקלידו שם שחקן ידנית</p>
          )}
        </>
      )}
    </div>
  );
}
