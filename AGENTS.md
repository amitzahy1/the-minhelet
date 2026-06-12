<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Data-refresh scripts

These scripts regenerate locked sections of source files between
`<generated-start>` / `<generated-end>` sentinels. Re-running is idempotent
and safe; hand-written code outside the sentinels is preserved.

| Script | When to run |
|---|---|
| `npx tsx scripts/sync-official-squads.ts` | After every federation announcement; promotes to FIFA-confirmed automatically after 2026-06-02. |
| `npx tsx scripts/sync-player-market-values.ts` | After every `sync-official-squads.ts` run. Requires non-corp network (Transfermarkt blocked by Cato firewall — see script header). |

## Pre-launch infrastructure (added 2026-05-27)

- **Scoring**: `src/lib/scoring/live-scorer.ts` is the authoritative engine.
  It scores groups + knockouts (with penalty-shootout handling), advancement
  picks, and special bets (final + live-tentative). Knockout slot resolution
  lives in `src/lib/scoring/knockout-resolver.ts`.
- **Point values are DB-driven (migration 026)**: the admin "ניקוד" tab edits
  the `scoring_config` row, which `src/lib/scoring/config.ts` (`scoringFromConfig`)
  resolves into the `ScoringValues` shape — per-field fallback to the `SCORING`
  constant in `src/types/index.ts`. Every scorer takes a `scoring` arg
  (default = constant); the live path threads it via
  `computeLiveScores(..., { scoring })`. Displays read the same values through
  `useScoring()` (or `useSharedData().scoring`). So the admin panel, live
  scoring, and the rules page can't disagree. **Edit point values in the admin
  tab — do NOT hardcode them in a component.**
- **Atomic save**: `save_user_predictions` Postgres RPC (migration 010) wraps
  the three table writes in a transaction. `src/lib/supabase/sync.ts` calls it
  and falls back to the legacy 3-upsert path only when the RPC isn't installed.
- **Admin overrides** live in `src/app/admin/components/OperationsPanel.tsx`:
  recompute scores, backup/restore, extend deadline, reset password, per-user
  lock toggle. Full playbook in `scripts/RESTORE.md`.
- **Daily backups**: Vercel cron at 07:00 UTC dumps every critical table to
  the `backups` Supabase Storage bucket. The bucket must be created once via
  the Supabase dashboard before the cron is meaningful.

## Live results pipeline (rebuilt 2026-06-12, opening-night incident)

- **Row mapping is centralized**: `src/lib/sync-results.ts` (`buildResultRows`)
  is the ONLY way FD matches become `demo_match_results` rows — stage map
  (GROUP_STAGE→GROUP, LAST_32→R32, LAST_16→R16…), `toAppCode` TLA fix-ups,
  90'-score selection (`regularTime ?? fullTime`), penalties, and a null-score
  guard (FD free tier flips FINISHED minutes before publishing the score — do
  NOT persist that window). Both `/api/sync` and the admin sync use it.
- **Sync fetches must be fresh**: `fetchAPI(..., { fresh: true })` →
  `cache: "no-store"`. A 10-min stale cache once persisted a null score.
- **Self-heal**: `/api/matches` persists FD-FINISHED scores missing from the
  demo table via `after()` — this (not the daily 06:00 cron; Vercel Hobby
  rejects sub-daily crons, twice proven in git history) is what lands results
  during the evening window. It skips entirely when the demo read fails, so it
  can never clobber admin-entered scores.
- **Fallback source**: `src/lib/api-thesportsdb.ts` (TheSportsDB, league 4429,
  free key "123") — group-stage finals FD hasn't published, matched strictly
  onto FD fixtures, and the cards board (`tournament_actuals.dirtiest_board`)
  from match timelines (FD free tier has NO bookings). Cards are MAX-merged so
  manual admin corrections survive the next sync.
- **⚠️ Group-pair orientation contract**: `group_predictions[G].scores[i]` is
  keyed AND oriented by `GROUP_MATCH_PAIRS` in `src/lib/results-hits.ts`
  (`[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]`, home = first index). Every writer
  (groups page `generateMatchups`, bot, fake-gen, admin editor) must mirror it
  exactly — the groups page once stored pairs 4+5 flipped and every human pick
  for those pairs silently scored as a miss (repaired by
  `scripts/migrate-flip-pairs-3-4.ts`, since disarmed).
- **RTL score display rule**: when a score sits BETWEEN team names (home on
  the right in RTL), render it `dir="ltr"` as `{away}-{home}` so the home
  goals are the right-hand digit. Standalone "ניחש X-Y" strings follow the
  same away-home order wherever they appear next to such a score.
