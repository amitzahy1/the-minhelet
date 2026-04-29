# WC2026 — Git History Deep Analysis
> 130+ commits analyzed · 12 feature clusters · APIs mapped · Improvement ideas per area

---

## Table of Contents

1. [Core Betting Engine](#1-core-betting-engine)
2. [Save & Sync Architecture](#2-save--sync-architecture)
3. [Scoring System](#3-scoring-system)
4. [Admin Panel](#4-admin-panel)
5. [Social Pages — Standings, Compare, Live](#5-social-pages)
6. [Special-Bets Tracker (Phase 4)](#6-special-bets-tracker)
7. [Best 8 Third-Place Teams (Annex C)](#7-best-8-third-place-teams)
8. [Squads & Market Values](#8-squads--market-values)
9. [Simulation & What-If](#9-simulation--what-if)
10. [UX & Animations](#10-ux--animations)
11. [Auth, Security & Deadlines](#11-auth-security--deadlines)
12. [External APIs](#12-external-apis)
13. [New Feature Recommendations](#13-new-feature-recommendations)

---

## 1. Core Betting Engine

### What was built
The heart of the app — a Zustand store managing every prediction a user can make:

| Layer | File | What it holds |
|---|---|---|
| Group predictions | `src/stores/betting-store.ts` | Groups A–L: team order + 6 match scores per group |
| Knockout bracket | `src/stores/bracket-store.ts` | R32 → R16 → QF → SF → 3rd Place → Final |
| Special bets | `src/stores/betting-store.ts` | 30+ fields: topscorer, finalists, dirtiest team, duels, etc. |

**Key commits:**
- `c1195c2` — initial full platform with groups + knockout + specials
- `6b2c719` — fixed R32 structure to match FIFA WC2026 regulation draw
- `b861a5b` — bracket doesn't resolve R32 slots until user enters group scores (smart cascade)
- `ed46578` — pad hydrated arrays so SF/QF/matchups render all slots even with partial data
- `54c5615` — auto-sync `group.order` from match scores (no manual ordering needed)

### APIs used
- **Supabase** — tables: `brackets`, `special_bets`, `advancements`, `league_members`
- **Internal store** — Zustand with Immer for immutable updates

### Current limitations
- Group order is derived from scores, but tiebreaking (head-to-head, goal difference, fair play) is not fully exposed to the user — they can't see *why* a team ranks above another
- The bracket store and betting store are separate — syncing them requires manual cascade logic
- No undo/redo for predictions

### Better implementation ideas
- **Visible tiebreaker tooltip**: When two teams are tied on points, show a mini-breakdown (head-to-head result, goal diff, goals scored) inline in the group table — the data is already computed in `src/lib/tournament/groups.ts`
- **Conflict indicator**: If the user predicts Team A advances from Group B but also has Team A losing in R32, show a yellow warning
- **Bracket drag-to-fill**: Use the existing `@dnd-kit` dependency (already installed!) to let users drag teams into bracket slots instead of using dropdowns

---

## 2. Save & Sync Architecture

### What was built
A multi-layered save system that evolved significantly over the project:

**Evolution:**
1. Manual save button (early)
2. Auto-sync on page load (`81ffd4f`)
3. Supabase becomes source of truth on login (`560a76b`)
4. Milestone-only auto-save + explicit "Save & Continue" (`b0906c4`)
5. Suppress ghost toasts during hydration (`b3e37e4`)
6. Batch saves + cascade toast system (`51ab487`)

**Key files:**
- `src/stores/save-status-store.ts` — tracks save state
- `src/stores/toast-store.ts` — toast notifications
- `src/lib/supabase/sync.ts` — user data sync logic
- `src/app/api/sync/route.ts` — hydration API endpoint

### APIs used
- `POST /api/sync` — hydrates local store from Supabase on login
- Supabase client-side `upsert` for saves

### Current limitations
- Save is all-or-nothing per section (groups, knockout, specials) — no per-match granularity in the save indicator
- The `demo_match_results` table and real `tournament_actuals` table are separate — merging them adds complexity
- No offline support — if a user loses connection mid-fill, edits are lost until next save attempt

### Better implementation ideas
- **Optimistic saves with rollback**: Save immediately to local state, send to Supabase in background, roll back + show error only on failure — already partially done, could be formalized
- **Conflict resolution on hydration**: If Supabase has newer data than local store (e.g., user opened two tabs), ask user which to keep instead of silently overwriting
- **IndexedDB offline cache**: Use `idb` library to persist bets locally — sync when online, preventing data loss on connection drops

---

## 3. Scoring System

### What was built
A full point-calculation engine with stage-based multipliers:

| Stage | Toto points (correct 1/X/2) | Exact score bonus |
|---|---|---|
| GROUP | 2 | 5 |
| R32 | 4 | 8 |
| R16 | 8 | 16 |
| QF | Higher | Higher |
| SF / FINAL | Highest | Highest |

**Key files:**
- `src/lib/scoring/calculator.ts` — core point calculation
- `src/lib/scoring/live-scorer.ts` — real-time scoring during matches
- `src/lib/results-hits.ts` — match prediction scoring
- `src/lib/tournament/annex-c.ts` — best 8 thirds selection

**Key commits:**
- `85c071d` — save indicator + completed-stage chips + tie handling + fake-bet filler
- `76a3707` — fixed critical bug: group letter parser matched 'G' in 'GROUP_' — broke all hit matching
- `f9f6ec0` — 3rd-place scoring + Annex C plumbing

### Current limitations
- No breakdown shown to users: they see total points but not *which matches* scored them
- Special bets scoring is binary (hit/miss) — no partial credit for "got the finalist right but not winner"
- Leaderboard doesn't show projected final score (based on current bracket, what can each user still earn?)

### Better implementation ideas
- **Points breakdown modal**: Click on a user's score → see a table of every match, their prediction, the result, and points earned. The data exists in `results-hits.ts`, just needs a UI
- **Maximum possible score**: For each user, compute how many points they can *still* earn if all their remaining picks come true — great for showing who's still mathematically in the race
- **Special bets partial scoring**: If a user got the finalist but not the winner (e.g., Brazil finalist, France wins) — award partial points. More nuanced and fairer

---

## 4. Admin Panel

### What was built
A comprehensive admin interface at `/admin` with 10+ sub-components:

| Component | File | Purpose |
|---|---|---|
| Match results entry | `AdminMatchResultsEntry.tsx` | Enter final scores for each match |
| Special results entry | `SpecialResultsEntry.tsx` | Enter topscorer, winner, etc. |
| Bot generator | `BotGenerator.tsx` | Auto-create FIFA-ranking-based predictions |
| User bets editor | `UserBetsEditor.tsx` | Override any user's predictions |
| User management | `UserManagement.tsx` | Delete, rename, hide users |
| Completion matrix | `CompletionMatrix.tsx` | See which users filled which sections |
| Best thirds override | `BestThirdsOverride.tsx` | Manually rank 3rd-place teams |
| Admin guide | `AdminGuide.tsx` | Documentation for admins |
| System status | `SystemStatus.tsx` | Health check |
| Admins list | `AdminsList.tsx` | View/add admins |

**Key commits:**
- `5fe1f02` — match results entry + post-lock user bet override
- `67abd45` — FIFA-ranking-based bot bettor auto-fill
- `0d4c62b` — user bets editor: user-overview table at top, click to select
- `c5ad6b3` — CSV export of all bets

### APIs used (all admin-only)
```
POST /api/admin/results          → enter match scores
POST /api/admin/special-results  → enter topscorer/winner etc.
POST /api/admin/bot              → generate bot predictions
POST /api/admin/fill-bets        → fill missing user predictions
POST /api/admin/fill-fake-bets   → generate test data
POST /api/admin/user-bets        → override a user's predictions
POST /api/admin/users            → list/search users
POST /api/admin/users/delete     → delete a user
POST /api/admin/users/update-nickname → rename a user
POST /api/admin/add-admin        → promote to admin
GET  /api/admin/list-admins      → list all admins
POST /api/admin/best-thirds      → override thirds ranking
GET  /api/admin/completion       → completion matrix
GET  /api/admin/export-bets      → export all bets as CSV
```

### Current limitations
- Match results must be entered manually — the Football-Data.org API has live scores that could auto-populate results
- No audit log: if an admin changes a user's bets, there's no record of who changed what
- Bot predictions are generated once and static — they don't update as the tournament progresses

### Better implementation ideas
- **Auto-import match results from Football-Data.org**: The API is already integrated in `/api/matches`. Add a "Sync Results from API" button in the admin panel that pulls `FINISHED` matches and auto-fills `demo_match_results` — eliminating manual entry for regular matches
- **Audit log table**: Add a `admin_audit_log` Supabase table — every admin action (edit user, enter result) writes a row with admin ID, timestamp, and what changed
- **Live bot updates**: After each match result is entered, run the bot scoring logic to update the bot bettor's standing dynamically

---

## 5. Social Pages

### What was built
Three social-facing pages that let users compare and compete:

**Standings (`/standings`)**
- Leaderboard with all bettors sorted by score
- Completion chips showing which stages each user filled
- HeroRoast component (hidden, pending real scoring)
- LeaderboardRace animation (hidden, pending real scoring)

**Compare (`/compare`)**
- Transposed view: bettors as columns, predictions as rows
- Tabs: advancement picks, special bets, results
- Bettor chips on leaders
- "Alive" tab showing who's still in contention
- Sparkline charts for score trends

**Live (`/live`)**
- Live group standings (pulling from Football-Data.org)
- Live bracket with current advancement state
- Colored bettor predictions overlay

**Key commits:**
- `d2030ec` — new /live page with live group standings + live bracket
- `84a03c5` — compare tabs share one transposed component + real sparkline
- `28bebc4` — transpose advancement + specials (bettors as columns)
- `cf249fc` — "alive" tab ported to compare

### APIs used
- `GET /api/shared-bets` — all users' public bets
- `GET /api/matches` — live scores from Football-Data.org
- `GET /api/tournament-stats` — top scorers, stats

### Current limitations
- HeroRoast and LeaderboardRace are hidden with a comment `(hidden until real scoring exists)` — they're fully built but turned off
- The compare page blocks all access before the deadline — users can't preview the format even in a demo/read-only mode
- No "direct duel" view: see your predictions vs. one specific person's predictions side by side

### Better implementation ideas
- **Enable HeroRoast immediately**: The component exists at `src/components/shared/HeroRoast.tsx` — just unhide it. It generates humorous roasts based on betting patterns
- **Direct duel mode**: Click any user's name → see your predictions vs. theirs in a head-to-head two-column layout. Great for WhatsApp group rivalry
- **Score over time chart**: Show how each user's rank changed after each match day — a proper time-series using the Recharts library already installed
- **"Who agrees with me" metric**: For each of your predictions, show what % of other bettors made the same pick

---

## 6. Special-Bets Tracker

### What was built
A real-time dashboard for tracking special bets outcomes (Phase 4):

- Per-category live view: topscorer, finalists, champion, etc.
- Shows which users hit each category
- Admin can enter special results
- Replaces the old transposed specials table

**Key files:**
- `src/components/shared/SpecialTrackerView.tsx`
- `src/app/api/admin/special-results/route.ts`

**Key commits:**
- `381bbdd` — Phase 4: live Special-Bets Tracker replaces transposed specials table
- `357335d` — live per-category dashboard with bettor hit/miss

### APIs used
- `GET /api/shared-bets` — fetches all users' special bets
- Supabase `tournament_actuals` table for actual results

### Current limitations
- Special bets scoring is entered manually by admin — no API to pull topscorer automatically
- No visual "nail-biter" indicator when a special bet result is close (e.g., two bettors have the same topscorer pick and the player is on 3 goals)
- The tracker doesn't show the full special bets form for users who haven't filled it

### Better implementation ideas
- **Auto-pull topscorer from Football-Data.org**: The `/api/tournament-stats` endpoint already fetches top scorers. Wire it to auto-update the special results without manual admin entry
- **"Still alive" indicator**: For picks that depend on ongoing tournament progress (e.g., "will Brazil reach the final"), show a real-time status: `✓ Still possible`, `✗ Eliminated`
- **Special bets deadline separate from main deadline**: Consider allowing users to lock in special bets (winner, topscorer) later than group stage picks — adds strategic depth

---

## 7. Best 8 Third-Place Teams

### What was built
Full implementation of FIFA's Annex C rule — selecting the best 8 from 12 third-place teams:

- `src/lib/tournament/annex-c.ts` — ranking algorithm
- `src/lib/tournament/thirds-ranker.ts` — tiebreaker logic (goal diff, goals scored, fair play)
- `src/components/admin/BestThirdsOverride.tsx` — admin manual override
- `BestThirdsPanel` — folded into existing tabs (latest commit `7186a10`)

**Key commits:**
- `f9f6ec0` — Best 8 thirds: live ranker, admin override, Annex C plumbing, 3rd-place scoring
- `7186a10` — fold best-thirds panel into existing tabs + rename

### APIs used
- `GET /api/best-thirds` — public endpoint returning current best 8 ranking
- `POST /api/admin/best-thirds` — admin override

### Current limitations
- The Annex C rule is complex and users may not understand why their third-place pick did or didn't advance
- No explanation shown to users about which groups' 3rd-place teams are being compared

### Better implementation ideas
- **Annex C explainer UI**: A collapsible table showing all 12 third-place teams, their points/GD/GF, and which 8 are selected — with the selection criteria explained in plain Hebrew
- **User prediction of best thirds**: Let users predict which 8 third-place teams advance (part of the bracket picks) — add points for correct predictions

---

## 8. Squads & Market Values

### What was built
Complete team rosters for all 48 WC2026 teams:

- **1,607 players** across 48 teams (`bcefd10` — 100% club coverage)
- Player photos from Transfermarkt/API sources
- Club names shown under each player on pitch formation
- Market values for ~400 players (`79c25bd`)
- Squad total market value display

**Key files:**
- `src/lib/tournament/squads-data.ts` — static squad data (large file)
- `src/lib/tournament/squad-photos.ts` — photo URLs
- `src/lib/tournament/market-values.ts` — player valuations
- `scripts/update-squads.ts`, `enrich-squads.ts` — data update scripts

**Key commits:**
- `bcefd10` — 100% club coverage: all 1607 players across 48 teams
- `4a05de8` — show market value on pitch + What-If shows predictions by default

### APIs used
- **Transfermarkt** (scraped, not official API) — market values
- **Football-Data.org** — team and player data

### Current limitations
- Squad data is static JSON baked into the bundle — won't update if players get injured/replaced
- Market values are a point-in-time snapshot (400 of 1607 players)
- No way for users to interact with squads (e.g., "which of these players do you think scores first?")

### Better implementation ideas
- **Dynamic squad updates via API**: Football-Data.org provides squad endpoints. Run a daily cron (already have `scripts/update-squads.ts`) to refresh squad data without rebuilding
- **"My squad picks" feature**: Let users pick their predicted starting XI for each team — adds a fun pre-tournament activity
- **Injury alert banner**: If a key player is flagged as injured/suspended in the squad data, show a banner on their team's card: "⚠️ Ronaldo — doubtful for Group stage"

---

## 9. Simulation & What-If

### What was built
A full tournament simulator:

- **72 group stage matches** with live score inputs
- **Knockout matches** down to the Final
- **Special bets simulation** — adjust predictions and see score impact
- **Standings-style leaderboard** showing simulated rankings

**Key files:**
- `src/app/(app)/what-if/` — What-If page
- Simulation logic embedded in standings components

**Key commits:**
- `8c42912` — full simulation: knockout matches + special bets + live scoring
- `0f22b05` — full simulation tab: 72 group matches with live scoring
- `8584233` — redesign SimulationTab with standings-style leaderboard
- `dca4fa7` — What-If score input + Simulation tab placeholder + market values

### Current limitations
- Simulation state is not persisted — refreshing the page resets all simulation inputs
- No "best case / worst case" auto-compute — users must manually adjust every score
- The simulation and the real live data are separate — users can't start from "current real scores" and extend forward

### Better implementation ideas
- **"Simulate from current" button**: Load all real match results so far, then let the user only fill in future matches — the most natural What-If experience
- **Auto-compute "what score do I need"**: Based on current standings, for each remaining match tell the user "if you need to beat [user X], you need [Brazil to beat France AND Argentina to win the tournament]"
- **Save simulation as "scenario"**: Let users name and save up to 3 simulation scenarios (e.g., "Brazil wins", "European dominance") and share them via a URL

---

## 10. UX & Animations

### What was built
A rich set of visual interactions:

| Feature | Component | Trigger |
|---|---|---|
| Splash screen | `SplashScreen.tsx` | App load — letter-by-letter 3D title, orbiting particles |
| Confetti | `useConfetti.ts` hook | Every 25-bet milestone, stage completion |
| Cascade toasts | `toast-store.ts` | Save, error, milestone messages |
| Match card expansion | Schedule page | Tap to expand and see all bets for a match |
| Bottom-sheet tooltip | Squads page | Mobile-friendly player details |
| Mobile bottom nav | Layout | 5-tab persistent nav |

**Key commits:**
- `dc4da9b` — letter-by-letter 3D title, orbiting particles, floating logo
- `51ab487` — cascade toast, batch saves, wizard rewrite
- `d8e418d` — P0 UX: mobile splash fit + overflow-x guard + bottom-nav

### Current limitations
- The splash screen shows every time — including for returning users who load the app mid-tournament. It should be shown only on first load or after a long absence
- Confetti fires on every 25-bet transition including when hydrating from DB — ghost celebrations
- No haptic feedback on mobile (native apps have this, PWA can too)

### Better implementation ideas
- **Skip splash for returning users**: Store a `lastVisited` timestamp in localStorage. If < 24h ago, skip the splash and go straight to the main page
- **Progress ring on nav tabs**: The bottom nav tabs already show which sections are filled — add a circular progress ring (0–100%) instead of a binary chip
- **Haptic feedback on save**: Use `navigator.vibrate(50)` when a bet is saved on mobile — subtle but satisfying
- **"Locked" celebration**: When the deadline passes and all picks are locked in, show a special one-time animation — "הפנקס נחתם! 🔒" with the user's total picks summary

---

## 11. Auth, Security & Deadlines

### What was built
Full auth and security system:

- Supabase Auth (email/password)
- Google OAuth (configured but not activated in Supabase)
- League code verification (`/api/verify-code`)
- Row-Level Security (RLS) on all tables
- Deadline enforcement: June 10, 2026 @ 14:00 UTC (`src/lib/constants.ts`)
- Middleware blocking all betting routes after deadline

**Key commits:**
- `98a43a3` — Phase 1: security, loading, admin status, error boundary
- `8de31bd` — sync bet visibility: all pages respect lock deadline
- `3a7ce5b` — fix: admin user renames were silently dropped by RLS
- `522fed5` — fix: completion matrix was empty (RLS blocked reads before lock)

### Current limitations
- League code is a static password — if it leaks, anyone can join
- No rate limiting on the verify-code API — brute-force possible
- Admin role check is done by email comparison, not a proper roles table

### Better implementation ideas
- **Invite links with expiry**: Generate time-limited invite links (`/join?token=abc123`) instead of a shared static code — each link works once
- **Rate limiting on verify-code**: Add a simple in-memory counter or use Supabase edge function rate limiting — max 10 attempts per IP per hour
- **Roles table in Supabase**: Move admin role from email-based check to a `roles` table — cleaner, allows multiple admin levels (super-admin, moderator)

---

## 12. External APIs

### APIs currently in use

#### Football-Data.org (Primary sports data source)
- **Base URL**: `https://api.football-data.org/v4`
- **Auth**: `X-Auth-Token` header (`FOOTBALL_DATA_TOKEN` env var)
- **Rate limit**: 10 requests/minute (free tier)
- **Wrapper file**: `src/lib/api-football-data.ts`

**Endpoints used:**
```
GET /competitions/WC/matches?season=2026           → all 104 matches + scores
GET /competitions/WC/standings?season=2026          → group standings
GET /competitions/WC/scorers?season=2026&limit=20   → top scorers
GET /competitions/WC/teams?season=2026              → team info + crests
```

**Caching**: Next.js ISR — `revalidate: 300` (5 minutes)

#### Supabase (Database + Auth)
All user data, bets, league management, and admin overrides stored here.

Tables identified from API routes:
- `profiles` — user info
- `leagues`, `league_members` — league management
- `brackets` — group + knockout predictions
- `special_bets` — special bet predictions
- `advancements` — group advancement picks
- `demo_match_results` — admin-entered match scores
- `tournament_actuals` — official tournament results

#### Bot predictions (Internal)
- `src/lib/bot-predictions.ts` — FIFA ranking-based auto-predictions
- Uses `src/lib/tournament/squads-data.ts` for team data
- No external API — algorithmic based on team strength ratings

### APIs available but not yet activated
- **API-Football** (`v3.football.api-sports.io`) — env vars exist (`API_FOOTBALL_KEY`, `API_FOOTBALL_HOST`) but no active calls. Offers: live lineups, player statistics, injury reports, VAR decisions
- **Google OAuth** — Supabase provider configured in code, needs activation in Supabase dashboard
- **Transfermarkt** — used for scraping squad/market data, not a stable API

### API improvement opportunities

1. **Switch topscorer auto-update to Football-Data.org**: Instead of manual admin entry, poll the scorers endpoint every 5 minutes during live matches

2. **Live match events from API-Football**: The free Football-Data.org doesn't give minute-by-minute events. API-Football (if you have a paid key) gives: goals, cards, substitutions — could power a live match ticker

3. **WhatsApp sharing via WhatsApp Business API**: Commit `b6afda2` mentions WhatsApp share. Using the share API (`navigator.share`) is simpler and already works — just needs a share button with pre-formatted text on the standings page

---

## 13. New Feature Recommendations

These are features that don't yet exist in the codebase but would add significant value:

---

### 🥇 Priority 1 — High Impact, Low Effort

#### 1. Points Breakdown Modal
**Where**: Standings page, clicking a user's score  
**What**: A table showing every match → user's prediction → actual result → points earned  
**Why**: The data exists in `results-hits.ts` and `scoring/calculator.ts`. Users constantly ask "how did I get X points?" This answers it.  
**Effort**: 1 day

---

#### 2. "Maximum Possible Score" Column
**Where**: Standings leaderboard  
**What**: Next to each user's current score, show their theoretical maximum if all remaining picks come true  
**Why**: Keeps lower-ranked users engaged — shows they can still win  
**Effort**: 1 day (scoring calculator already handles this)

---

#### 3. Score History Chart (Sparkline per User)
**Where**: Standings page, next to each user's name  
**What**: A mini line chart showing their rank/score after each match day  
**Why**: Recharts is already installed. Creates a narrative — "I was winning after the group stage…"  
**Effort**: 2 days (need to store score snapshots per match day in Supabase)

---

#### 4. Auto-Import Match Results from API
**Where**: Admin panel — "Sync Results" button  
**What**: Pulls all `FINISHED` matches from Football-Data.org and auto-fills the results table  
**Why**: Eliminates manual admin work for 104 match results  
**Effort**: 1 day (Football-Data.org wrapper already exists)

---

### 🥈 Priority 2 — Medium Impact, Medium Effort

#### 5. Direct Duel View
**Where**: Standings page → click any user's avatar  
**What**: A side-by-side comparison of your predictions vs. that specific user's predictions  
**Why**: The social engine of prediction apps. "Me vs. my brother-in-law"  
**Effort**: 2 days

---

#### 6. Push Notifications (PWA)
**Where**: Service worker + Supabase push  
**What**: Notify users when: a match they predicted starts, their score changes, a match they bet on has a goal  
**Why**: The app is installable as PWA (already set up). Push notifications drive re-engagement  
**Effort**: 3 days

---

#### 7. "Simulate from Current" in What-If
**Where**: What-If / Simulation page  
**What**: Load all real results so far, let user only fill in *future* matches  
**Why**: The current simulator makes users re-enter past scores manually. This removes friction.  
**Effort**: 2 days

---

#### 8. Audit Log for Admin Actions
**Where**: Admin panel, new "Audit" tab  
**What**: A Supabase table `admin_audit_log` that records every admin action (who changed what, when)  
**Why**: When a user complains their bets were changed, admins can verify what happened  
**Effort**: 2 days (add log writes to each admin API route)

---

### 🥉 Priority 3 — Nice to Have

#### 9. "Who Agrees With Me" Metric
**Where**: On each pick in the groups/knockout/special-bets pages  
**What**: Small chip showing "73% agree" next to each prediction  
**Why**: Social proof + interesting to see where you're contrarian  
**Effort**: 3 days (aggregate shared-bets data)

---

#### 10. Match Day Timeline / Ticker
**Where**: New tab on /live page  
**What**: A chronological feed of match events (goals, cards) pulled from API-Football if key becomes available  
**Why**: Keeps users on the site during live matches — highest engagement moment of the tournament  
**Effort**: 3-5 days (depends on API access tier)

---

## Summary Table

| # | Feature | Impact | Effort | Status |
|---|---------|--------|--------|--------|
| 1 | Points breakdown modal | High | Low | Not built |
| 2 | Max possible score column | High | Low | Not built |
| 3 | Score history sparklines | High | Medium | Partial (sparklines exist on compare) |
| 4 | Auto-import match results | High | Low | Not built |
| 5 | Direct duel view | High | Medium | Not built |
| 6 | Push notifications | Medium | Medium | Not built |
| 7 | Simulate from current | Medium | Medium | Not built |
| 8 | Admin audit log | Medium | Medium | Not built |
| 9 | "Who agrees with me" | Medium | Medium | Not built |
| 10 | Match day ticker | High | High | Not built |
| — | HeroRoast component | Medium | **Zero** | **Built, just hidden** |
| — | LeaderboardRace animation | Medium | **Zero** | **Built, just hidden** |

> **Quick win**: HeroRoast and LeaderboardRace are fully built and just need to be unhidden in the standings page. Zero effort, immediate impact.

---

*Generated from analysis of 130+ git commits · April 2026*
