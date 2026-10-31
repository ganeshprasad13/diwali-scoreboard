// Pure scoring logic — no DOM, fully unit-testable (see tests/).
// rp = points a team earns per round (G3 = 0.5 per correct guess). points = game points for the winning team.
export const GAMES = [
  { id: 'g1', name: 'Cup Tic-Tac-Toe',        points: 10, rounds: 5,  rp: 1 },
  { id: 'g2', name: 'Grab the Cup!',          points: 15, rounds: 5,  rp: 1 },
  { id: 'g3', name: 'Truth or Bluff',         points: 20, rounds: 10, rp: 0.5 },
  { id: 'g4', name: 'Dumb Charades',          points: 25, rounds: 5,  rp: 1 },
  { id: 'g5', name: 'Dizzy Race',             points: 30, rounds: 5,  rp: 1 }
];
export const BONUS = 5;
export const other = t => (t === 'red' ? 'blue' : 'red');
export const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const fresh = () => ({
  v: 1,
  teams: { red: { name: 'Team Red' }, blue: { name: 'Team Blue' } },
  members: [], adjustments: [], log: [],
  finale: { team: '', eliminated: [], winner: null },
  games: Object.fromEntries(GAMES.map(g => [g.id, {
    override: null,
    rounds: Array.from({ length: g.rounds }, () => ({ w: null, pr: '', pb: '' })),
    bonus: { challenge: '', awarded: null },
    pred: { a: [], b: [], ca: 0, cb: 0 }
  }]))
});

export function gameResult(game, s) {
  const g = s.games[game.id], tally = { red: 0, blue: 0 };
  g.rounds.forEach(r => { if (r.w === 'red' || r.w === 'blue') tally[r.w] += game.rp; });
  const done = g.rounds.filter(r => r.w).length;
  let winner = g.override || null;
  if (!winner && done === game.rounds && tally.red !== tally.blue) winner = tally.red > tally.blue ? 'red' : 'blue';
  return { tally, done, winner, tie: done === game.rounds && !winner };
}

export function scores(s) {
  const t = { red: { main: 0, bonus: 0, adj: 0, total: 0 }, blue: { main: 0, bonus: 0, adj: 0, total: 0 }, decided: 0 };
  GAMES.forEach(g => {
    const r = gameResult(g, s);
    if (!r.winner) return;
    t.decided++;
    t[r.winner].main += g.points;
    if (s.games[g.id].bonus.awarded === true) t[other(r.winner)].bonus += BONUS;
  });
  s.adjustments.forEach(a => { t[a.team].adj += Number(a.points) || 0; });
  for (const k of ['red', 'blue']) t[k].total = t[k].main + t[k].bonus + t[k].adj;
  return t;
}
