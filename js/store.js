// State + persistence. Every change is saved instantly to localStorage and (when configured) Firestore with an offline queue.
// Roles: admin (you) = full access. member (username@diwali.party) = read-only public snapshot + cheers.
import { firebaseConfig, DOC } from './config.js';
import { fresh, buildPub } from './scoring.js';
const LS = 'diwali-scoreboard-v1', cloud = !!firebaseConfig.apiKey, DOMAIN = 'diwali.party';
let data, pub = null, cheers = {}, role = 'admin', st = cloud ? 'saving' : 'local', needLogin = cloud;
let FA, A, F, auth, db, ref, pubRef, unsub = [], synced = false;
const cbs = [], scb = [];
const emit = () => cbs.forEach(f => f()), setSt = v => { st = v; scb.forEach(f => f()); };
const mirror = () => { try { localStorage.setItem(LS, JSON.stringify(data)); } catch {} };
const clean = o => JSON.parse(JSON.stringify(o));
const norm = u => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
const mEmail = u => `${norm(u)}@${DOMAIN}`, mPass = p => `${norm(p)}#diwali`;  // pad so short names meet Firebase's 6-char minimum

export const onChange = f => cbs.push(f), onStatus = f => scb.push(f);
export const state = () => data, status = () => st, needsLogin = () => needLogin, isCloud = () => cloud;
export const getRole = () => role, getPub = () => pub, getCheers = () => cheers;
export const me = () => auth?.currentUser?.email?.split('@')[0].toLowerCase() || '';
export const statusLabel = () => ({ local: 'Local mode', saving: 'Saving…', saved: role === 'member' ? 'Live ●' : 'Saved ✓', offline: 'Offline – queued', error: 'Save error!' })[st];

function persist() {
  mirror();
  if (!cloud || !F || !ref || role !== 'admin') return;
  setSt('saving');
  const b = F.writeBatch(db);
  b.set(ref, clean(data)); b.set(pubRef, clean(buildPub(data)));
  b.commit().catch(() => setSt('error'));
}
export function update(label, fn) {
  fn(data);
  data.log.unshift({ t: Date.now(), m: label });
  data.log.length = Math.min(data.log.length, 300);
  persist(); emit();
}
export function replace(next, label) { data = Object.assign(fresh(), next); update(label, () => {}); }

const stop = () => { unsub.forEach(f => f()); unsub = []; };
function listenCheers() { unsub.push(F.onSnapshot(F.collection(db, 'cheers'), s => { cheers = {}; s.forEach(d => { cheers[d.id] = d.data(); }); emit(); }, () => {})); }
function listenAdmin() {
  unsub.push(F.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    const m = snap.metadata;
    if (snap.exists() && !m.hasPendingWrites) {
      const d = snap.data();
      if (JSON.stringify(d) !== JSON.stringify(data)) { data = Object.assign(fresh(), d); mirror(); emit(); }
    } else if (!snap.exists() && !m.fromCache) persist();
    if (snap.exists() && !m.fromCache && !synced) { synced = true; persist(); }   // refresh member snapshot once per session
    setSt(m.hasPendingWrites ? 'saving' : (m.fromCache && !navigator.onLine ? 'offline' : 'saved'));
  }, () => setSt('error')));
  listenCheers();
}
function listenMember() {
  unsub.push(F.onSnapshot(pubRef, s => { pub = s.exists() ? s.data() : null; setSt('saved'); emit(); }, () => setSt('error')));
  listenCheers();
}

export async function init() {
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(LS))); } catch { data = fresh(); }
  if (!cloud) return;
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [fa, a, f] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  FA = fa; A = a; F = f;
  const app = FA.initializeApp(firebaseConfig);
  db = F.initializeFirestore(app, { localCache: F.persistentLocalCache() });
  ref = F.doc(db, ...DOC); pubRef = F.doc(db, 'public', 'scoreboard');
  auth = A.getAuth(app);
  A.onAuthStateChanged(auth, u => {
    stop(); pub = null;
    if (!u) { needLogin = true; emit(); return; }
    role = u.email.toLowerCase().endsWith('@' + DOMAIN) ? 'member' : 'admin';
    needLogin = false;
    role === 'admin' ? listenAdmin() : listenMember();
    emit();
  });
}
// Members type just a username (no @) + same password; admin types a full email.
export const login = (u, p) => u.includes('@') ? A.signInWithEmailAndPassword(auth, u.trim(), p) : A.signInWithEmailAndPassword(auth, mEmail(u), mPass(p));
export const logout = () => A.signOut(auth);
export const cheer = team => F.setDoc(F.doc(db, 'cheers', auth.currentUser.uid), { name: me(), team, n: F.increment(1) }, { merge: true }).catch(() => {});

// Admin: bulk-create member accounts using a second Firebase app instance so YOUR session stays signed in.
export async function createLogins(list) {
  const fb = FA.getApps().find(x => x.name === 'creator') || FA.initializeApp(firebaseConfig, 'creator'), a2 = A.getAuth(fb), out = [];
  for (const n of list.map(norm).filter(Boolean)) {
    try { await A.createUserWithEmailAndPassword(a2, mEmail(n), mPass(n)); out.push('✔ created: ' + n); }
    catch (e) { out.push((e.code === 'auth/email-already-in-use' ? '• already exists: ' : '✖ ' + e.code + ': ') + n); }
    await A.signOut(a2);
  }
  return out;
}
