// Simplified copy of the standings logic
const teams = [
  { id: 1, code: "BRA" },
  { id: 2, code: "ARG" },
  { id: 3, code: "GER" },
  { id: 4, code: "JPN" },
];

function makeMatch(h, a, hg, ag, id = 0) {
  return { match_id: id, home_team_code: h, away_team_code: a, home_goals: hg, away_goals: ag };
}

const matches = [
  makeMatch("BRA", "ARG", 1, 0, 1),
  makeMatch("GER", "BRA", 1, 0, 2),
  makeMatch("BRA", "JPN", 1, 0, 3),
  makeMatch("ARG", "GER", 5, 0, 4),
  makeMatch("ARG", "JPN", 3, 0, 5),
  makeMatch("GER", "JPN", 0, 0, 6),
];

// Calculate stats
const statsMap = new Map();
for (const team of teams) {
  statsMap.set(team.code, {
    team_id: team.id,
    team_code: team.code,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
    fair_play_score: 0,
  });
}

for (const match of matches) {
  const home = statsMap.get(match.home_team_code);
  const away = statsMap.get(match.away_team_code);
  if (!home || !away) continue;

  home.played++;
  away.played++;
  home.goals_for += match.home_goals;
  home.goals_against += match.away_goals;
  away.goals_for += match.away_goals;
  away.goals_against += match.home_goals;

  if (match.home_goals > match.away_goals) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (match.home_goals < match.away_goals) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points += 1;
    away.points += 1;
  }
}

console.log("Stats before sorting:");
for (const [code, stats] of statsMap) {
  const gd = stats.goals_for - stats.goals_against;
  console.log(`${code}: ${stats.points} pts, GF ${stats.goals_for}, GA ${stats.goals_against}, GD ${gd}`);
}

// Sort by points only (as per current code)
const allTeams = Array.from(statsMap.values());
const primary = [...allTeams].sort((a, b) => b.points - a.points);

console.log("\nAfter sorting by points only (should maintain insertion order for equal points):");
for (const t of primary) {
  const gd = t.goals_for - t.goals_against;
  console.log(`${t.team_code}: ${t.points} pts, GD ${gd}`);
}

// Group by equal points
console.log("\nGrouping by equal points:");
let i = 0;
while (i < primary.length) {
  let j = i + 1;
  while (j < primary.length && primary[j].points === primary[i].points) j++;
  const run = primary.slice(i, j);
  console.log(`Group ${i}: [${run.map(t => t.team_code).join(", ")}]`);
  i = j;
}
