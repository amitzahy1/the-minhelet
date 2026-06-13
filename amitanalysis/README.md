# amitanalysis — Amit's WC2026 bets: verification, simulation & optimization

A from-scratch quantitative review of **Amit's** World Cup 2026 prediction-game slip: extract the bets, build a market-calibrated Monte-Carlo, score every bet by expected points, and recommend what to change before lock.

## 👉 Start here
- **[change-list.md](change-list.md)** — the action list, ranked by expected-points gain. Do this before **today 17:00 Israel** (full-slip lock).
- **[verification-report.md](verification-report.md)** — every bet verified, with probabilities, EV, and keep/change.

## What's in the folder
| File | What |
|---|---|
| `amit-bets.json` / `.txt` / `.raw.json` | Amit's full slip — resolved (readable), and raw DB rows (audit). Live-verified, zero drift. |
| `extract-amit-bets.ts` | Re-pulls the slip from Supabase and resolves codes→teams/fixtures. |
| `engine/run.ts` | The Monte-Carlo engine (ratings → Poisson → 200k sims → per-bet EV). |
| `engine-results.json` | All output probabilities + EV + EV-optimal alternatives. |
| `data/odds-market.json` | Bookmaker consensus + Polymarket (de-vigged): winner, group winners, top scorer/assists, best attack, reach-final. |
| `data/models.json` | 6 forecast models (Groll/Zeileis, Nate Silver, Opta, ESPN-DTAI, Goldman Sachs) + consensus. |
| `data/report-data.json` + `report.txt` | Structured + full text of the 277-pp Kimi report. |
| `data/form-injuries.md` | Last-2-weeks friendlies, injuries, penalty-takers per team. |
| `data/scoring-config.json` | Live point values (from the DB). |
| `report-digest.md` | Digest + trust assessment of the Kimi report. |

## Method (one paragraph)
Each team gets a strength rating = `group_level + intra-group_spread`. The **spread** is calibrated so the sim reproduces the **market group-winner** odds (matches within <1pp); the **levels** are calibrated so it reproduces a **blended champion target** (market + 6 models + report; within ~1-2pp). Matches are sampled from an independent-Poisson goal model on the rating gap; knockouts add a shootout coin-flip. Each of 200,000 tournaments is played through the **app's own bracket pipeline** (`thirds-ranker` → Annex-C → R32 topology) so the simulated bracket equals the one that scores the bets. Every bet's expected points is then computed under the **live `scoring_config`**, alongside the EV-optimal alternative.

## Headline result
The slip is **strong** (~200 expected lockable points). Champion (Spain), both finalists, all 16 R16 picks, top-assists (Bruno Fernandes) and several specials are already EV-optimal. **≈ +8–10 points** are available, mostly from **(1) replacing ~10 group-stage draws with favourite wins** and **(2) switching top-scorer from Oyarzabal to Mbappé**. The knockout *match* scorelines are a separate **live** bet (~130 pts) filled during the tournament, not today.

## Re-run
```bash
npx tsx amitanalysis/extract-amit-bets.ts     # refresh the slip from Supabase
npx tsx amitanalysis/engine/run.ts 200000      # recalibrate + simulate + score
```
Calibration auto-targets whatever is in `data/odds-market.json` + `models.json` + `report-data.json`, so updating those (e.g. fresher odds) and re-running refreshes every recommendation.

## Caveats
Model calibrated to the betting market; scoreline & special EV gains are robust, deep-run advancement EV may be slightly favourite-optimistic. "Prolific/driest group" edges are low-confidence. The Kimi report is a prior, not gospel (see its digest). No comparison to other bettors (by request) — this optimizes Amit's own expected points.
