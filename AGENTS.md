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
