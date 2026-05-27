# WC2026 — Backup & Restore Playbook

## Daily backups

A Vercel cron at **07:00 UTC** calls `POST /api/admin/backup-snapshot`, which
dumps every persistence-critical table (`profiles`, `leagues`, `league_members`,
`user_brackets`, `special_bets`, `advancement_picks`, `demo_match_results`,
`tournament_actuals`, `scoring_config`, `scoring_snapshots`, `player_stats`,
`admin_audit_log`, `admins`, `tournaments`) to a single JSON blob in the
Supabase Storage `backups/` bucket with key `backup-YYYY-MM-DDTHH-MM.json`.

The cron authenticates as `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.

## Pre-tournament checkpoints

| Date | Action | Owner |
|---|---|---|
| **2026-06-06** (5 days pre-tournament) | Manually trigger snapshot via admin panel + verify it lands in `backups/`. Run dry-run restore against it. | Admin |
| **2026-06-10** (1 day pre-tournament, lock day) | Manual snapshot **before** lock fires (13:00 UTC). Manual snapshot **after** lock (14:30 UTC). Verify `backfill_locked_at()` ran so post-lock reveal works. | Admin |
| Each match-day | Cron snapshot at 07:00 UTC + post-final manual snapshot at 23:00 local. | Admin / cron |

## Manual snapshot

```bash
curl -X POST https://<host>/api/admin/backup-snapshot \
  -H "Cookie: <admin session cookie>"
```

Response:
```json
{ "ok": true, "key": "backup-2026-06-06T07-00.json", "snapshotAt": "...", "errors": [] }
```

If the `backups` bucket isn't created yet, the response includes a `warning`
and the payload inline — save it locally and create the bucket via Supabase
dashboard before retrying.

## Listing backups

```bash
curl https://<host>/api/admin/backup-snapshot \
  -H "Cookie: <admin session cookie>"
```

Returns `{ backups: [{ name, created_at, ... }] }`.

## Restoring

**Dry run** — counts rows but writes nothing:
```bash
curl -X POST "https://<host>/api/admin/restore?key=backup-2026-06-06T07-00.json&dry_run=1" \
  -H "Cookie: <admin session cookie>"
```

**Apply** — upserts every row by primary key. This OVERWRITES current state.
Always run dry-run first.
```bash
curl -X POST "https://<host>/api/admin/restore?key=backup-2026-06-06T07-00.json&dry_run=0" \
  -H "Cookie: <admin session cookie>"
```

Response: `{ ok: true, key, dryRun, summary: { <table>: { count, restored, error? } } }`.

## Recovery scenarios

### "A user's score is wrong"
1. `POST /api/admin/recompute` — refreshes `scoring_snapshots` for every user from raw bets + match results.
2. If still wrong, inspect their bets via `GET /api/admin/user-bets?userId=X`. Patch via `PATCH` if needed.
3. Re-run `/api/admin/recompute`.

### "All scores are wrong (rule change)"
1. Update `scoring_config` via admin panel.
2. `POST /api/admin/recompute` — snapshots reflect the new config.

### "A user lost access to their account"
`POST /api/admin/users/reset-password { email: "user@example.com" }` → returns
a recovery link to share with the user.

### "Lock fired too early due to clock bug"
`POST /api/admin/extend-deadline { deadline: "2026-06-11T00:00:00Z" }` →
overrides the global deadline. Pass `{ deadline: null }` to clear.

### "User's bracket locked when it shouldn't be"
`POST /api/admin/users/lock-state { userId: "...", lock: false }`.

### "Need to roll back to a known-good snapshot"
1. `GET /api/admin/backup-snapshot` → pick the snapshot key.
2. `POST /api/admin/restore?key=...&dry_run=1` → verify counts.
3. `POST /api/admin/restore?key=...&dry_run=0` → apply.
4. `POST /api/admin/recompute` → refresh scores.

## Credentials & environment

Required env vars on the deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `FOOTBALL_DATA_TOKEN` (free-tier scorers feed)

Bucket setup (one-time):
1. Supabase dashboard → Storage → New bucket → `backups` (private).
2. No public policy needed — only the service role writes/reads.
