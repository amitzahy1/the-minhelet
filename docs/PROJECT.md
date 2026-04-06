# WC2026 — Project Documentation

## Overview

Private social prediction platform for FIFA World Cup 2026. Replaces the combination of PronoContest app + WhatsApp supplement bets that the group used in Qatar 2022 and Euro 2024. Everything is now in one place — no more manual WhatsApp messages for special bets.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Client State | Zustand (with immer middleware) |
| Server State | TanStack Query v5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth + Email/Password) |
| Real-time | Supabase Realtime (WebSocket) |
| Football Data | API-Football (free tier, 150K req/day) |
| Drag & Drop | @dnd-kit |
| Animations | Framer Motion |
| Deployment | Vercel |

## Project Structure

```
wc2026/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login & signup pages
│   │   ├── auth/callback/      # OAuth callback handler
│   │   ├── bracket/            # Bracket builder (main flow)
│   │   │   └── specials/       # Special bets page
│   │   ├── predictions/        # Daily match predictions
│   │   ├── league/             # League management
│   │   │   ├── create/
│   │   │   ├── join/
│   │   │   └── [leagueId]/     # League dashboard
│   │   ├── live/               # Live match tracker
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── bracket/            # Bracket builder components
│   │   ├── predictions/        # Match prediction components
│   │   ├── league/             # League components
│   │   ├── live/               # Live match components
│   │   └── shared/             # Shared components (TeamBadge, ScoreInput)
│   ├── lib/
│   │   ├── supabase/           # Supabase client (browser/server/middleware)
│   │   ├── tournament/         # Tournament logic (groups, standings, allocation)
│   │   ├── validation/         # Conflict validation engine
│   │   └── scoring/            # Points calculation
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript type definitions
├── supabase/
│   ├── migrations/             # SQL migration files
│   └── functions/              # Edge Functions (data sync, scoring)
├── docs/
│   ├── PROJECT.md              # This file
│   └── RULES.md                # Game rules (editable)
└── public/
    └── flags/                  # Team flag assets
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends Supabase auth.users) |
| `leagues` | Private betting leagues |
| `league_members` | User ↔ League membership |
| `league_config` | League admin settings (match-up players, penalty line, prizes) |
| `teams` | 48 national teams with FIFA data |
| `matches` | All 104 tournament matches |
| `user_brackets` | Pre-tournament bracket predictions (JSONB) |
| `advancement_picks` | Pre-tournament advancement picks |
| `special_bets` | Special bets (top scorer, best attack, etc.) |
| `match_predictions` | Per-match score predictions (during tournament) |
| `scoring_log` | Point-by-point audit trail |
| `badges` | Achievement definitions |
| `user_badges` | Earned achievements |

## User Flow

### Pre-Tournament
1. Sign up (Google or Email) → Join league via invite code
2. Build bracket:
   - **Step 1:** Group Stage — drag teams to predicted order + enter all 6 match scores per group
   - **Step 2:** Third Place — select 8 of 12 third-place teams to advance
   - **Step 3:** Knockout — enter scores + winners from R32 to Final
   - **Step 4:** Special Bets — top scorer, assists, best attack, etc.
3. Lock bracket (auto-locks 1 hour before first match)

### During Tournament
1. Daily: enter score predictions for today's matches
2. Validation engine checks consistency with bracket
3. Watch live scores, track points earned
4. Check leaderboard

### Post-Tournament
1. Final summary with stats
2. Winner declared
3. Share results

## Key Algorithms

### Group Standings Calculator
- Implements all 6 FIFA tiebreaker levels: points → GD → goals scored → H2H → fair play → lots
- Located in `src/lib/tournament/standings.ts`

### Validation Engine
- **Group stage:** Checks if entered match scores produce the predicted group order
- **Knockout:** Checks if match winner matches the bracket's predicted advancement path
- Located in `src/lib/validation/`

### 495-Scenario Allocation Table
- Maps which third-place teams face which group winners in R32
- Static lookup table from FIFA Annex C (12 choose 8 = 495 combinations)
- Located in `src/lib/tournament/allocation-table.ts`

### Scoring Calculator
- Match scoring: toto (1X2) + exact score, escalating by round
- Advancement scoring: group position (exact/partial), QF, SF, Final, Winner
- Special bets: top scorer, assists, best attack, etc.
- Located in `src/lib/scoring/calculator.ts`

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key
API_FOOTBALL_KEY=               # API-Football API key
API_FOOTBALL_HOST=              # API-Football host
```

## Running Locally

```bash
npm install
cp .env.local.example .env.local  # Fill in your keys
npm run dev                        # Start dev server on localhost:3000
```

## Deployment

```bash
# Push to GitHub, connect to Vercel
# Set environment variables in Vercel dashboard
# Deploy automatically on push to main
```
