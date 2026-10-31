# 🪔 Diwali Party Scoreboard

Static web app (no build step) for tracking teams, members, round scores, bonus challenges, prediction rounds, the G6/G7 finale, manual adjustments and an audit log.
Hosted free on **GitHub Pages**; data saved instantly to **Firebase Firestore** (works offline, syncs later). Single admin login.

## Scoring rules implemented
- G1–G5 worth 10/15/20/25/30 pts to the game winner (most round points). Rounds: 5/5/10/5/5; G3 rounds are worth 0.5 each.
- Ties can be settled with **Winner override**. Losing team gets a +5 bonus challenge and a prediction round (two sub-teams, correct-prediction counters).
- Champion = highest total incl. bonus + manual adjustments. Finale tab runs G6 Musical Chairs → G7 Backward Bottle Race.

## Part A — Firebase (the database + your login), ~10 min
1. https://console.firebase.google.com → **Add project** (disable Analytics) .
2. Project settings (gear) → **Your apps** → **</>** Web → register → copy the `firebaseConfig` values into `js/config.js`.
3. **Build → Firestore Database → Create database** → pick a nearby region (e.g. `asia-south1`) → Production mode.
4. **Build → Authentication → Get started → Email/Password → Enable.**
5. **Authentication → Users → Add user** → your email + strong password. Copy the **User UID**.
6. **Firestore → Rules** → paste `firestore.rules`, replace `PASTE_YOUR_ADMIN_UID_HERE` with your UID → **Publish**.
7. Authentication → **Settings → User actions** → untick *Enable create (sign-up)*.
8. After deploying (Part B): Authentication → **Settings → Authorized domains → Add** `YOUR-USERNAME.github.io`.

> The Firebase `apiKey` in config.js is not a secret — your security comes from the login + the Firestore rules above.

## Part B — GitHub Pages
```bash
cd diwali-scoreboard
git init -b main
git add .
git commit -m "Diwali scoreboard"
# create an EMPTY repo on github.com (e.g. diwali-scoreboard), then:
git remote add origin https://github.com/YOUR-USERNAME/diwali-scoreboard.git
git push -u origin main
```
Then on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The workflow in `.github/workflows/deploy.yml` runs automatically; after ~1 minute your app is live at
`https://YOUR-USERNAME.github.io/diwali-scoreboard/` (check the **Actions** tab if not).

## Part C — Venue checklist
1. Open the site once on good internet and sign in (this caches the app for offline use).
2. Phone: browser menu → **Add to Home screen**.
3. Test: switch on airplane mode, enter a score, switch it off → status goes *Offline – queued* → *Saved ✓*.
4. During the party: **Settings → Export JSON backup** after each game. Use **Display mode** on a TV/laptop.

## Updating later
Edit files → `git add . && git commit -m "msg" && git push` → auto-redeploys. Hard-refresh the page (or reopen twice) to pick up the new version.

## Local testing
`python3 -m http.server 8000` → http://localhost:8000 (Local Mode if config.js is empty). Tests: `node tests/scoring.test.mjs`.
