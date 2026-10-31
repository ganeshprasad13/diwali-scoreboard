// Run: node tests/scoring.test.mjs   (also runs automatically before every deploy)
import assert from 'node:assert/strict';
import { fresh, scores, gameResult, GAMES } from '../js/scoring.js';

const s = fresh();
s.games.g1.rounds.forEach((r, i) => { r.w = i < 3 ? 'red' : 'blue'; });
assert.equal(gameResult(GAMES[0], s).winner, 'red');

s.games.g3.rounds.forEach((r, i) => { r.w = i < 5 ? 'red' : 'blue'; });   // 2.5 – 2.5
assert.equal(gameResult(GAMES[2], s).tie, true);
s.games.g3.override = 'blue';

s.games.g1.bonus.awarded = true;                 // losing team (blue) gets +5
s.adjustments.push({ team: 'red', points: -2 });
const t = scores(s);
assert.deepEqual([t.red.total, t.blue.total], [10 - 2, 20 + 5]);
console.log('scoring tests passed');
