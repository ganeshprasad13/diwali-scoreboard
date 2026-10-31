// State + persistence. Every change is saved instantly:
//  1) to localStorage (instant mirror), 2) to Firestore (cloud, with offline queue) when configured.
import { firebaseConfig, DOC } from './config.js';
import { fresh } from './scoring.js';
const LS = 'diwali-scoreboard-v1', cloud = !!firebaseConfig.apiKey;
let data, st = cloud ? 'saving' : 'local', needLogin = cloud, F, A, auth, ref, unsub;
const cbs = [], scb = [];
const emit = () => cbs.forEach(f => f()), setSt = v => { st = v; scb.forEach(f => f()); };
const mirror = () => { try { localStorage.setItem(LS, JSON.stringify(data)); } catch {} };
const clean = o => JSON.parse(JSON.stringify(o));

export const onChange = f => cbs.push(f), onStatus = f => scb.push(f);
export const state = () => data, status = () => st, needsLogin = () => needLogin, isCloud = () => cloud;
export const statusLabel = () => ({ local: 'Local mode', saving: 'Saving…', saved: 'Saved ✓', offline: 'Offline – queued', error: 'Save error!' })[st];

function persist() {
  mirror();
  if (!cloud || !F || !ref) return;
  setSt('saving');
  F.setDoc(ref, clean(data)).catch(() => setSt('error'));
}
export function update(label, fn) {
  fn(data);
  data.log.unshift({ t: Date.now(), m: label });
  data.log.length = Math.min(data.log.length, 300);
  persist(); emit();
}
export function replace(next, label) { data = Object.assign(fresh(), next); update(label, () => {}); }

function listen() {
  if (unsub) return;
  unsub = F.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    const m = snap.metadata;
    if (snap.exists() && !m.hasPendingWrites) {
      const d = snap.data();
      if (JSON.stringify(d) !== JSON.stringify(data)) { data = Object.assign(fresh(), d); mirror(); emit(); }
    } else if (!snap.exists() && !m.fromCache) persist();
    setSt(m.hasPendingWrites ? 'saving' : (m.fromCache && !navigator.onLine ? 'offline' : 'saved'));
  }, () => setSt('error'));
}

export async function init() {
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(LS))); } catch { data = fresh(); }
  if (!cloud) return;
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [app, a, f] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  A = a; F = f;
  const fa = app.initializeApp(firebaseConfig);
  ref = F.doc(F.initializeFirestore(fa, { localCache: F.persistentLocalCache() }), ...DOC);
  auth = A.getAuth(fa);
  A.onAuthStateChanged(auth, u => {
    if (!u) { needLogin = true; if (unsub) { unsub(); unsub = null; } emit(); return; }
    needLogin = false; listen(); emit();
  });
}
export const login = (e, p) => A.signInWithEmailAndPassword(auth, e, p);
export const logout = () => A.signOut(auth);
