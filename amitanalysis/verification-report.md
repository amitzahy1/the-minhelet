# Amit — WC2026 Bet Verification & Simulation Report

**Date:** 2026-06-10 · **Engine:** `amitanalysis/engine/run.ts` · **Sims:** 200,000 · **Scoring:** live `scoring_config` (DB).
**Sources:** bookmaker consensus + Polymarket (`data/odds-market.json`), 6 forecast models (`data/models.json`), the 277-pp *Kimi* report (`data/report-data.json`, [report-digest.md](report-digest.md)), form/injuries/friendlies (`data/form-injuries.md`).

This report verifies **every bet on your slip** against a market-calibrated Monte-Carlo. For each: the model probability, expected points, and a **KEEP / CHANGE** verdict. Action summary is in [change-list.md](change-list.md).

---

## 1. How the model was built (and why you can trust it)

A single strength rating per team → a Poisson scoreline model → 200k full-tournament simulations that **reuse the app's own bracket logic** (`thirds-ranker` → Annex-C assignment → R32 topology), so the simulated bracket is the *same* one that scores your bets. Ratings were calibrated until the simulation reproduced two independent market anchors:

**Champion probability — simulation vs targets (calibration check):**

| Team | Sim | Blend target | Market | Reach SF | Reach QF |
|---|---|---|---|---|---|
| Spain | 16.7% | 16.3% | 15.5% | 43% | 57% |
| France | 13.5% | 14.2% | 14.8% | 35% | 55% |
| England | 10.0% | 10.0% | 10.6% | 30% | 50% |
| Argentina | 9.7% | 10.4% | 8.5% | 28% | 45% |
| Brazil | 9.1% | 7.4% | 8.1% | 29% | 45% |
| Germany | 8.2% | 7.5% | 5.7% | 29% | 51% |
| Portugal | 7.4% | 7.1% | 9.0% | 25% | 41% |
| Netherlands | 4.5% | 3.9% | 4.1% | 18% | 31% |

**Group-winner — simulation vs market (favourite of each group):** A 56/56 · B 54/54 · C 71/71 · D 41/42 · E 74/74 · F 54/54 · G 71/71 · H 77/77 · I 62/62 · J 74/74 · K 61/61 · L 68/68. **Match within <1pp everywhere.** Champion matches within ~1-2pp. The model is well-calibrated.

> The 6 independent forecasters (Groll/Zeileis, Nate Silver/PELE, Opta, ESPN-DTAI, Goldman Sachs, + market) **unanimously rank Spain #1**, and flag **Portugal as market-overpriced** and **Argentina as model-underrated** — both of which show up in your bets below.

---

## 2. Expected-points scorecard (your current slip)

| Category | Max | Your E[pts] | Notes |
|---|---|---|---|
| Group scorelines (72) | 216 | **88.9** | →94.5 achievable; you have 10 low-EV draws |
| Group qualifiers (24 slots) | 72 | **42.0** | near-optimal (42.5 max) |
| Advance → R16 (×16) | 32 | **19.5** | **EV-optimal set** |
| Advance → QF (×8) | 24 | **11.2** | near-optimal |
| Advance → SF (×4) | 24 | **7.9** | →8.3 (swap POR→ENG) |
| Advance → Final (×2) | 20 | **5.0** | EV-optimal (ESP+FRA) |
| Champion | 16 | **2.7** | EV-optimal (ESP) |
| Specials (10 bets) | 68 | **≈ 23** | top-scorer is the weak link |
| **TOTAL (lockable today)** | **~472** | **≈ 200** | +8–10 available from the change-list |
| *Knockout match scores (Tree 2)* | *~132* | *— (live, later)* | *not locked today — see §7* |

Expected points are model estimates; the **relative** keep/change calls are robust even where the absolute number is uncertain.

---

## 3. The bracket: champion, finalists, deep run

- **Champion — Spain (16 pts).** ✅ **KEEP — optimal.** Spain is the most likely champion in the simulation (16.7%), the market (15.5%), and **all six** forecast models. Risk noted by the Kimi report + form: Lamine Yamal's hamstring (may miss the first 1-2 group games) and no elite #9 — but Spain still tops every source. No better pick exists.
- **Finalists — Spain + France (10 pts each).** ✅ **KEEP — optimal.** They are the two highest reach-final teams (ESP 28%, FRA 22%). Note: the Kimi report assumes ESP & FRA share a bracket half (so they'd meet in the semi); **the app's bracket — which is what scores you — puts H1 (Spain) and I1 (France) in opposite halves**, so an ESP-vs-FRA final is valid here. (If you ever doubt the app's bracket vs official FIFA, that's a game-wide question, not specific to your slip.)
- **Semi-finalists — your 4: Brazil, Spain, France, Portugal.** ⚠️ **One change.** ESP (43%) and FRA (35%) are top-2 — keep. BRA (29%) is fine. **Portugal (25%) → England (30%)**: England reaches the semis more often, and models agree Portugal is over-rated. **+0.34 EV.**
- **Quarter-finalists — your 8** (GER, BRA, ESP, SUI, FRA, ARG, ENG, POR): near-optimal (11.2 of 11.25). The only sub-optimal name is **Switzerland (32%)** vs **Belgium (33%)** — a virtual tie, **not worth changing.**
- **Round-of-16 — your 16:** ✅ **EV-OPTIMAL.** Your 16 picks are exactly the 16 teams with the highest reach-R16 probability. Perfect.

---

## 4. Group stage — order & scorelines

### Group qualifiers (1st/2nd) — 3 pts exact, 1 pt for a 1↔2 swap, **0 for a 3rd-place qualifier**

Near-optimal overall (42.0 of 42.5). Two improvable slots:

- **Group A — you: Mexico / Korea.** Mexico 1st ✅ (56%). But **Czechia is more likely 2nd (33%) than Korea (25%)** — ESPN's market agrees (Czechia +350 vs Korea +650 for the runner-up spot). **2nd pick Korea → Czechia: +0.33 EV.**
- **Group G — you: Belgium / Egypt.** Belgium 1st ✅ (71%). **Iran edges Egypt for 2nd (34% vs 29%).** Optional **Egypt → Iran: +0.17 EV.**
- Groups **B, C, D, E, F, H, I, J, K, L:** ✅ already EV-optimal. (Spain/Uruguay, Brazil/Morocco, Germany/Ecuador, France/Norway, Argentina/Austria, Portugal/Colombia, England/Croatia — all correct.)

### Group scorelines — the biggest single opportunity (≈ +5 pts)

You predicted **10 draws** in 72 games. Backing the favourite by one goal beats a draw on EV in every mismatch. See [change-list.md §A](change-list.md) for the ranked list of 11 specific changes (Brazil-Morocco, Mexico-Korea, Paraguay-Turkey, NZ-Iran, Netherlands-Japan, …). General rule: **don't predict draws in mismatched games — back the favourite 1-0/2-0.**

---

## 5. Special bets (verified one-by-one)

| Bet | Pts | Your pick | Model/market read | Verdict |
|---|---|---|---|---|
| **Top scorer** | 12 / 7 | Mikel Oyarzabal | Market joint-3rd (~6.6%); Kimi bearish ("no 30+ goal striker"). Mbappé (~14%) & Kane (~12%) ~2× more likely. EV: Oyarzabal ≈2.8 vs **Mbappé ≈5.0** | ❌ **CHANGE → Mbappé** (+~2.0) |
| **Top assists** | 9 / 5 | Bruno Fernandes | **Clear market favourite +900** (record 21 PL assists; PT penalties/set-pieces). Your single best pick. EV ≈ 4.1 | ✅ **KEEP** |
| **Best attack** | 8 | Spain | Sim #1 (14.6%); market favourite (+300, 24%). | ✅ **KEEP** |
| **Penalties O/U 21.5** | 6 | OVER | 104 matches × ~0.3-0.4 pen/match ≈ 31-42 ≫ 21.5. P(OVER) ≈ 85%. | ✅ **KEEP** |
| **Most prolific group** | 6 | I | Sim ranks I 4th (8.9%); C (13.0%) & E (12.0%) higher — but clustered/low-confidence. | ⚪ Optional → C/E |
| **Driest group** | 6 | G | Sim ranks G 5th (8.6%); **Group A driest (13.8%)** (Mex/Kor/Cze/RSA, no elite attack). | ⚠️ **CHANGE → A** (+0.31) |
| **Dirtiest team** | 6 | Argentina | No strong card data either way; Argentina is a defensible aggressive pick. | ✅ Keep (low data) |
| Duel: **Messi** v Ronaldo | 5 | Messi | Messi higher goals+assists; Ronaldo's minutes managed (subbed HT in warm-up). | ✅ **KEEP** |
| Duel: **Raphinha** v Vinícius | 5 | Raphinha | Raphinha is Brazil's penalty-taker, in form — but market lists Vini's assists higher. ~coin-flip. | ✅ Keep (slight lean) |
| Duel: Mbappé v **Kane** | 5 | Kane | Mbappé higher goals+assists expectation (top-scorer favourite + more assists). | ⚠️ **CHANGE → Mbappé** (+0.5) |

---

## 6. Cross-source champion table (for context)

| Team | Market | Groll/Zeileis | Nate Silver | Opta | Goldman | Kimi report | **Our sim** |
|---|---|---|---|---|---|---|---|
| Spain | 15.5 | 14.5 | 16.1 | 16.1 | 25.7 | 16.5 | **16.7** |
| France | 14.8 | 12.4 | 11.7 | 13.0 | 18.9 | 15.0 | **13.5** |
| England | 10.6 | 12.4 | 10.4 | 11.2 | 5.0 | 11.0 | **10.0** |
| Argentina | 8.5 | 8.2 | 11.0 | 10.4 | 14.3 | 12.0 | **9.7** |
| Brazil | 8.1 | 4.7 | 6.1 | 6.6 | 7.6 | 9.0 | **9.1** |
| Germany | 5.7 | 11.2 | 6.6 | 5.1 | 4.5 | 11.0 | **8.2** |
| Portugal | 9.0 | 8.9 | 4.9 | 7.0 | 4.8 | 7.0 | **7.4** |

Our sim sits inside the cross-source range for every top team. (Germany is the one team models love more than the market — your QF pick of Germany is well-supported.)

---

## 7. Don't forget: the live knockout tree (Tree 2)

Your pre-tournament knockout **scorelines** earn **zero** points by design — only their *winners* fed your advancement picks (already analysed above). The knockout **match** points (toto+exact for each R32→Final game, **~130 pts of upside**) come from the separate **live tree**, which is **empty now** and is filled **per match during the tournament**, before each kickoff. This is the single largest pool you haven't engaged yet — set a reminder to fill each round as the real matchups appear.

---

## 8. Caveats
- Model calibrated to the betting market (champion ±1-2pp, group-winner <1pp). Scoreline & special EV gains are robust; deep-run advancement EV may be slightly favourite-optimistic vs the conservative Kimi report.
- Player-prop EV (top scorer/assists) blends market probability with a heuristic "≥3 goals / ≥2 assists" rate for the 7/5-pt consolation; directionally strong, not exact.
- The Kimi report is AI-generated and has internal defects (its champion table's *tail*, ranks 18-48, lists teams not in the real draw) — only its top-team/group analysis was used, always cross-checked against the live market.
- Re-run anytime: `npx tsx amitanalysis/engine/run.ts 200000`.
