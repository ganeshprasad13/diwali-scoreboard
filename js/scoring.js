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

// Points each member earned for their team (rounds where they were the player and their team won).
export function contributions(s) {
  const c = {};
  s.members.forEach(m => { c[m.id] = { played: 0, won: 0, pts: 0 }; });
  GAMES.forEach(g => s.games[g.id].rounds.forEach(r => {
    [['red', 'pr'], ['blue', 'pb']].forEach(([t, k]) => {
      const id = r[k]; if (!id || !c[id]) return;
      c[id].played++;
      if (r.w === t) { c[id].won++; c[id].pts += g.rp; }
    });
  }));
  return c;
}

// Read-only snapshot shown to members (written to Firestore doc public/scoreboard).
export function buildPub(s) {
  const con = contributions(s), nm = id => s.members.find(m => m.id === id)?.name || '';
  return {
    updated: Date.now(),
    teams: { red: s.teams.red.name, blue: s.teams.blue.name },
    scores: scores(s),
    games: GAMES.map(g => {
      const r = gameResult(g, s), gm = s.games[g.id];
      return { id: g.id, name: g.name, points: g.points, rounds: g.rounds, done: r.done, tally: r.tally, winner: r.winner || '',
        bonus: r.winner ? (gm.bonus.awarded === true ? 'awarded' : gm.bonus.awarded === false ? 'missed' : 'pending') : '' };
    }),
    members: s.members.filter(m => m.team).map(m => ({ id: m.id, name: m.name, team: m.team, ...con[m.id] })),
    finale: { winner: nm(s.finale.winner), out: s.finale.eliminated.map(nm).filter(Boolean) },
    feed: s.log.slice(0, 15)
  };
}
