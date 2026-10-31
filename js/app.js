import { GAMES, BONUS, other, gameResult, scores, fmt, fresh } from './scoring.js';
import * as store from './store.js';

const $ = s => document.querySelector(s), S = store.state, U = store.update;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tn = t => S().teams[t].name, mem = t => S().members.filter(m => m.team === t);
const mname = id => S().members.find(m => m.id === id)?.name || '—';
const time = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const teamOpts = (sel, blank) => ['red', 'blue'].map(t => `<option value="${t}" ${sel === t ? 'selected' : ''}>${esc(tn(t))}</option>`).join('') + (blank ? `<option value="" ${!sel ? 'selected' : ''}>${blank}</option>` : '');
const NAV = [['dash', 'Dashboard'], ['games', 'Games'], ['members', 'Members'], ['finale', 'Finale'], ['ledger', 'Ledger'], ['settings', 'Settings']];
let gsel = 'g1';

/* ---------- views ---------- */
const hero = big => { const sc = scores(S()); return `<section class="hero ${big ? 'big' : ''}">${['red', 'blue'].map(t => `<div class="team ${t}"><h2>${esc(tn(t))}</h2><div class="num">${fmt(sc[t].total)}</div><small>Main ${fmt(sc[t].main)} · Bonus ${fmt(sc[t].bonus)} · Adj ${fmt(sc[t].adj)}</small></div>`).join('')}</section>`; };
const bar = () => { const sc = scores(S()), a = sc.red.total, b = sc.blue.total; return `<div class="bar"><i style="width:${a + b > 0 ? a / (a + b) * 100 : 50}%"></i></div>`; };
const loginView = () => `<form class="card login"><h2>🪔 Admin sign in</h2><input id="em" type="email" placeholder="Email" required autocomplete="username"><input id="pw" type="password" placeholder="Password" required autocomplete="current-password"><button>Sign in</button><p id="le" class="red"></p></form>`;

function dash() {
  const s = S(), sc = scores(s);
  const rows = GAMES.map(g => {
    const r = gameResult(g, s), b = s.games[g.id].bonus;
    return `<tr><td>${g.id.toUpperCase()} ${esc(g.name)}</td><td>${g.points}</td><td>${fmt(r.tally.red)} – ${fmt(r.tally.blue)}</td><td>${r.winner ? `<b class="${r.winner}">${esc(tn(r.winner))}</b>` : r.tie ? 'Tie – set winner' : `${r.done}/${g.rounds} rounds`}</td><td>${r.winner ? (b.awarded === true ? `+${BONUS} ${esc(tn(other(r.winner)))}` : b.awarded === false ? 'not won' : 'pending') : '—'}</td></tr>`;
  }).join('');
  const champ = sc.decided < 5 ? '' : `<div class="card"><h2>${sc.red.total === sc.blue.total ? '🤝 Scores level – decide a tie-break' : `🏆 Ultimate Team Champion: ${esc(tn(sc.red.total > sc.blue.total ? 'red' : 'blue'))}!`}</h2></div>`;
  return `${store.isCloud() ? '' : '<div class="card">⚠️ <b>Local mode</b> — data lives only in this browser. Configure Firebase (README) for cloud saving.</div>'}${hero()}${bar()}${champ}
  <div class="card"><h3>Game summary</h3><div class="scroll"><table><tr><th>Game</th><th>Pts</th><th>Rounds (R – B)</th><th>Winner</th><th>Bonus</th></tr>${rows}</table></div></div>
  <a class="btn" href="#/display">📺 Open big-screen display</a>`;
}

function games() {
  const s = S(), G = GAMES.find(g => g.id === gsel), gm = s.games[gsel], r = gameResult(G, s);
  const opt = (t, sel) => '<option value="">— player —</option>' + mem(t).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  const rounds = gm.rounds.map((x, i) => `<div class="round"><b>${i + 1}</b><select data-ch="pr" data-i="${i}">${opt('red', x.pr)}</select><select data-ch="pb" data-i="${i}">${opt('blue', x.pb)}</select><span class="seg">${[['red', '🔴 Red'], ['none', 'None'], ['blue', '🔵 Blue']].map(([w, l]) => `<button class="${w} ${x.w === w ? 'on' : ''}" data-act="rw" data-i="${i}" data-w="${w}">${l}</button>`).join('')}</span></div>`).join('');
  let extra = '';
  if (r.winner) {
    const L = other(r.winner), P = gm.pred;
    const chip = m => `<button class="chip ${P.a.includes(m.id) ? 'a' : P.b.includes(m.id) ? 'b' : ''}" data-act="sub" data-id="${m.id}">${esc(m.name)}</button>`;
    extra = `<div class="card"><h3>🎁 Bonus challenge — ${esc(tn(L))} (+${BONUS})</h3><input data-ch="bch" placeholder="Challenge (e.g. best team dance)" value="${esc(gm.bonus.challenge)}"><p class="seg">${[[true, 'Awarded'], [false, 'Not won'], [null, 'Pending']].map(([v, l]) => `<button class="${gm.bonus.awarded === v ? 'on' : ''}" data-act="bonus" data-v="${v}">${l}</button>`).join('')}</p></div>
    <div class="card"><h3>🔮 Prediction round — ${esc(tn(L))}</h3><button data-act="split">🎲 Random split</button><p class="mut">Tap a name to cycle: Sub-team A → B → none.</p><div>${mem(L).map(chip).join('') || '—'}</div>
    <div class="pred">${['a', 'b'].map(k => `<div><b>Sub-team ${k.toUpperCase()}</b> (${P[k].length} players)<div class="step"><button data-act="pc" data-k="${k}" data-d="-1">−</button><span>${P['c' + k]}</span><button data-act="pc" data-k="${k}" data-d="1">+</button></div><small class="mut">correct predictions</small></div>`).join('')}</div>
    <b>${P.ca === P.cb ? 'Level' : `🏅 Sub-team ${P.ca > P.cb ? 'A' : 'B'} leads`}</b></div>`;
  }
  return `<div>${GAMES.map(g => `<button class="chip ${g.id === gsel ? 'on' : ''}" data-act="sel" data-g="${g.id}">${g.id.toUpperCase()}</button>`).join('')}</div>
  <div class="card"><h3>${G.id.toUpperCase()} · ${esc(G.name)} — ${G.points} pts</h3>
  <p><b class="red">${esc(tn('red'))} ${fmt(r.tally.red)}</b> – <b class="blue">${fmt(r.tally.blue)} ${esc(tn('blue'))}</b> · ${r.done}/${G.rounds} rounds · ${r.winner ? `Winner: <b>${esc(tn(r.winner))}</b>` : r.tie ? '<b>Tie — pick winner below</b>' : 'in progress'}</p>
  <p class="mut">${G.id === 'g3' ? 'Mark the team that guessed correctly (0.5 pt each).' : G.id === 'g2' ? 'Mark the player/team who grabbed the cup first (1 pt each).' : 'Mark the team that won the round.'}</p>${rounds}
  <div class="row"><span class="mut">Winner override:</span><select data-ch="ov"><option value="">Auto (most points)</option>${teamOpts(gm.override)}</select></div></div>${extra}`;
}

function members() {
  const s = S();
  const rows = s.members.map(m => `<tr><td><input data-ch="mn" data-id="${m.id}" value="${esc(m.name)}"></td><td><select data-ch="mt" data-id="${m.id}">${teamOpts(m.team, 'Unassigned')}</select></td><td><button class="x" data-act="mdel" data-id="${m.id}">✕</button></td></tr>`).join('');
  return `<div class="card"><h3>Add members</h3><textarea id="bulk" rows="4" placeholder="One name per line"></textarea><div class="row" style="margin-top:.5rem"><select id="bt">${teamOpts('', 'Unassigned')}</select><button data-act="madd">Add</button><button data-act="shuffle">🎲 Auto-balance all</button></div></div>
  <div class="grid2">${['red', 'blue'].map(t => `<div class="card"><h3 class="${t}">${esc(tn(t))} (${mem(t).length})</h3>${mem(t).map(m => esc(m.name)).join(', ') || '—'}</div>`).join('')}</div>
  <div class="card"><h3>All members (${s.members.length})</h3><div class="scroll"><table>${rows}</table></div></div>`;
}

const fin = s => { const sc = scores(s), t = s.finale.team || (sc.red.total >= sc.blue.total ? 'red' : 'blue'), pool = s.members.filter(m => m.team === t); return { t, pool, left: pool.filter(m => !s.finale.eliminated.includes(m.id)) }; };
function finale() {
  const s = S(), F = s.finale, { t, pool, left } = fin(s);
  return `<div class="card"><h3>🪑 G6 Musical Chairs — ${esc(tn(t))}</h3><div class="row"><span class="mut">Team:</span><select data-ch="ft"><option value="">Auto (leading team)</option>${teamOpts(F.team)}</select></div>
  <p>Players left: <b>${left.length}</b> · Chairs needed: <b>${Math.max(left.length - 1, 0)}</b> · ${left.length > 2 ? 'Tap a name to eliminate' : 'Finalists decided!'}</p>
  <div>${left.map(m => `<button class="chip ${left.length <= 2 ? 'on' : ''}" ${left.length > 2 ? `data-act="elim" data-id="${m.id}"` : ''}>${esc(m.name)}${left.length > 2 ? ' ✕' : ''}</button>`).join('') || '<span class="mut">Add members to this team first.</span>'}</div>
  ${F.eliminated.length ? `<p class="mut">Out: ${F.eliminated.map(mname).join(' → ')} <button data-act="unelim">Undo last</button></p>` : ''}</div>
  ${pool.length >= 2 && left.length <= 2 ? `<div class="card"><h3>🍾 G7 Backward Bottle Race — Grand Finale</h3><p>Tap the winner:</p>${left.map(m => `<button class="chip ${F.winner === m.id ? 'on' : ''}" data-act="champ" data-id="${m.id}">${esc(m.name)}</button>`).join('')}${F.winner ? `<h2>🏆 ${esc(mname(F.winner))} is the overall winner!</h2>` : ''}</div>` : ''}`;
}

function ledger() {
  const s = S();
  return `<div class="card"><h3>➕ Manual bonus / penalty</h3><div class="row"><select id="at">${teamOpts('red')}</select><input id="ap" type="number" step="0.5" placeholder="+5 or -2"><input id="ar" placeholder="Reason"><button data-act="adj">Add</button></div>
  ${s.adjustments.map(a => `<div class="li"><b class="${a.team}">${esc(tn(a.team))}</b> ${a.points > 0 ? '+' : ''}${a.points} — ${esc(a.reason)} <small class="mut">${time(a.t)}</small><button class="x" data-act="adel" data-id="${a.id}">✕</button></div>`).join('')}</div>
  <div class="card"><h3>🧾 Activity log (latest 300)</h3>${s.log.map(l => `<div class="li"><small class="mut">${time(l.t)}</small> ${esc(l.m)}</div>`).join('') || '—'}</div>`;
}

function settings() {
  return `<div class="card"><h3>Team names</h3><div class="row"><input data-ch="tname" data-t="red" value="${esc(tn('red'))}"><input data-ch="tname" data-t="blue" value="${esc(tn('blue'))}"></div></div>
  <div class="card"><h3>Backup & tools</h3><div class="row"><button data-act="exj">⬇ Export JSON backup</button><button data-act="exc">⬇ Export CSV</button><label class="btn">⬆ Import JSON<input type="file" id="imp" accept=".json" hidden></label><a class="btn" href="#/display">📺 Display mode</a><button onclick="print()">🖨 Print</button></div></div>
  <div class="card"><h3>Danger zone</h3><div class="row"><button class="danger" data-act="reset">Reset everything</button>${store.isCloud() ? '<button data-act="logout">Sign out</button>' : ''}</div></div>`;
}

/* ---------- render ---------- */
function render() {
  if (store.needsLogin()) { $('#top').innerHTML = ''; $('#app').innerHTML = loginView(); return; }
  const r = location.hash.slice(2) || 'dash';
  if (r === 'display') { $('#top').innerHTML = ''; $('#app').innerHTML = `<div class="display">${hero(true)}${bar()}<a class="x" href="#/dash">✕</a></div>`; return; }
  $('#top').innerHTML = `<b>🪔 Scoreboard</b><nav>${NAV.map(([k, l]) => `<a href="#/${k}" class="${k === r ? 'on' : ''}">${l}</a>`).join('')}</nav><span class="pill ${store.status()}">${store.statusLabel()}</span>`;
  $('#app').innerHTML = ({ dash, games, members, finale, ledger, settings }[r] || dash)();
}

/* ---------- actions ---------- */
const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
function act(d) {
  const s = S(), G = GAMES.find(g => g.id === gsel), gm = s.games[gsel], gl = G.id.toUpperCase();
  switch (d.act) {
    case 'sel': gsel = d.g; render(); break;
    case 'rw': { const nw = gm.rounds[d.i].w === d.w ? null : d.w; U(`${gl} round ${+d.i + 1}: ${nw ? (nw === 'none' ? 'no score' : tn(nw)) : 'cleared'}`, x => { x.games[gsel].rounds[d.i].w = nw; }); break; }
    case 'bonus': { const v = d.v === 'true' ? true : d.v === 'false' ? false : null; U(`${gl} bonus: ${v === null ? 'pending' : v ? 'awarded' : 'not won'}`, x => { x.games[gsel].bonus.awarded = v; }); break; }
    case 'sub': U(`${gl} sub-team change: ${mname(d.id)}`, x => { const p = x.games[gsel].pred, inA = p.a.includes(d.id), inB = p.b.includes(d.id); p.a = p.a.filter(i => i !== d.id); p.b = p.b.filter(i => i !== d.id); if (!inA && !inB) p.a.push(d.id); else if (inA) p.b.push(d.id); }); break;
    case 'split': { const r = gameResult(G, s); if (!r.winner) break; const L = shuffle(mem(other(r.winner)).map(m => m.id)), h = Math.ceil(L.length / 2); U(`${gl} prediction sub-teams split`, x => { x.games[gsel].pred.a = L.slice(0, h); x.games[gsel].pred.b = L.slice(h); }); break; }
    case 'pc': U(`${gl} prediction ${d.k.toUpperCase()} ${d.d > 0 ? '+1' : '−1'}`, x => { const p = x.games[gsel].pred; p['c' + d.k] = Math.max(0, p['c' + d.k] + +d.d); }); break;
    case 'madd': { const names = $('#bulk').value.split('\n').map(n => n.trim()).filter(Boolean), t = $('#bt').value; if (names.length) U(`Added ${names.length} member(s)`, x => names.forEach(n => x.members.push({ id: uid(), name: n, team: t }))); break; }
    case 'shuffle': U('Teams auto-balanced', x => shuffle(x.members).forEach((m, i) => { m.team = i % 2 ? 'blue' : 'red'; })); break;
    case 'mdel': if (confirm(`Remove ${mname(d.id)}?`)) U(`Removed ${mname(d.id)}`, x => { x.members = x.members.filter(m => m.id !== d.id); }); break;
    case 'elim': if (fin(s).left.length > 2) U(`G6: ${mname(d.id)} eliminated`, x => { x.finale.eliminated.push(d.id); }); break;
    case 'unelim': U('G6: undo last elimination', x => { x.finale.eliminated.pop(); x.finale.winner = null; }); break;
    case 'champ': U(`G7 winner: ${mname(d.id)}`, x => { x.finale.winner = x.finale.winner === d.id ? null : d.id; }); break;
    case 'adj': { const p = parseFloat($('#ap').value); if (!p) break; U(`Manual ${p > 0 ? '+' : ''}${p} for ${tn($('#at').value)}`, x => x.adjustments.unshift({ id: uid(), t: Date.now(), team: $('#at').value, points: p, reason: $('#ar').value.trim() || 'Manual adjustment' })); break; }
    case 'adel': U('Adjustment removed', x => { x.adjustments = x.adjustments.filter(a => a.id !== d.id); }); break;
    case 'exj': dl(`diwali-backup-${Date.now()}.json`, JSON.stringify(s, null, 2), 'application/json'); break;
    case 'exc': {
      const sc = scores(s), rows = [['Team', 'Main', 'Bonus', 'Adjustments', 'Total'], ...['red', 'blue'].map(t => [tn(t), sc[t].main, sc[t].bonus, sc[t].adj, sc[t].total]), [], ['Game', 'Points', 'Red rounds', 'Blue rounds', 'Winner']];
      GAMES.forEach(g => { const r = gameResult(g, s); rows.push([g.name, g.points, r.tally.red, r.tally.blue, r.winner ? tn(r.winner) : '']); });
      rows.push([], ['Member', 'Team']); s.members.forEach(m => rows.push([m.name, m.team ? tn(m.team) : '']));
      dl('scoreboard.csv', rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); break;
    }
    case 'reset': if (prompt('Type RESET to erase ALL data') === 'RESET') store.replace(fresh(), 'Event reset'); break;
    case 'logout': store.logout(); break;
  }
}
function ch(d, v) {
  switch (d.ch) {
    case 'ov': U(`${gsel.toUpperCase()} winner override: ${v ? tn(v) : 'auto'}`, x => { x.games[gsel].override = v || null; }); break;
    case 'pr': case 'pb': U(`${gsel.toUpperCase()} round ${+d.i + 1} ${d.ch === 'pr' ? 'red' : 'blue'} player: ${mname(v)}`, x => { x.games[gsel].rounds[d.i][d.ch] = v; }); break;
    case 'bch': U(`${gsel.toUpperCase()} bonus challenge set`, x => { x.games[gsel].bonus.challenge = v; }); break;
    case 'mt': U(`${mname(d.id)} → ${v ? tn(v) : 'unassigned'}`, x => { x.members.find(m => m.id === d.id).team = v; }); break;
    case 'mn': U(`Renamed member to ${v}`, x => { x.members.find(m => m.id === d.id).name = v.trim() || 'Unnamed'; }); break;
    case 'ft': U('G6 team changed', x => { x.finale.team = v; x.finale.eliminated = []; x.finale.winner = null; }); break;
    case 'tname': U(`Team renamed: ${v}`, x => { x.teams[d.t].name = v.trim() || x.teams[d.t].name; }); break;
  }
}

/* ---------- wiring ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset); });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'imp') {
    try { const o = JSON.parse(await el.files[0].text()); if (!o.teams || !o.games) throw 0; if (confirm('Replace ALL current data with this backup?')) store.replace(o, 'Backup imported'); }
    catch { alert('Invalid backup file'); }
    return;
  }
  if (el.dataset.ch) ch(el.dataset, el.value);
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  try { await store.login($('#em').value, $('#pw').value); } catch { $('#le').textContent = 'Sign-in failed. Check email and password.'; }
});
store.onChange(render);
store.onStatus(() => { const p = $('.pill'); if (p) { p.className = 'pill ' + store.status(); p.textContent = store.statusLabel(); } });
addEventListener('hashchange', render);
store.init().then(render);
