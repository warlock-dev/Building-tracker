# Turn on Google sign-in + cloud sync (≈10 minutes, free)

You'll use **Firebase** (Google's own service). Its free "Spark" plan is far more than a site ledger needs.
After this, you sign in with Google on any phone/PC, and everything you enter is saved in the cloud, live-synced, and works offline.

## 1 · Create the project
1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `site-ledger`) → turn **Google Analytics off** → Create.

## 2 · Enable Google sign-in
1. Left menu **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable → pick your support email → Save.
3. **Settings → Authorized domains → Add domain** → add `YOUR-GITHUB-USERNAME.github.io`
   (without this, sign-in on your website will say "unauthorized domain").

## 3 · Create the database
1. **Build → Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)** (can't be changed later). Choose **Production mode** → Enable.
3. Open the **Rules** tab, delete everything, paste the contents of **`firestore.rules`** from this folder,
   and **change `you@gmail.com` to your own Google email** (lowercase). Click **Publish**.
   *These rules are what keep strangers out — nobody can read or write unless signed in with an allowed email.*

## 4 · Connect the website
1. **Project settings** (gear icon) → **General** → scroll to **Your apps** → click the **`</>` Web** icon → nickname → Register app.
2. You'll see a `firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." }` block.
3. Open **`config.js`** and copy those four values in, plus your email as `ownerEmail` (same email as in the rules):
   ```js
   window.SITE_CONFIG = {
     ownerEmail: 'you@gmail.com',
     firebase: { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' }
   };
   ```
   (These values are not secret. The rules + Google sign-in protect the data.)

## 5 · Publish on GitHub Pages
Upload **all** files in this folder to the repo root (`index.html`, `styles.css`, `app.js`, `config.js`, `sw.js`,
`manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`) → Settings → Pages → *Deploy from branch* → `main` / root.
Open `https://YOUR-USERNAME.github.io/REPO-NAME/` and tap **Sign in with Google**. 🎉

## Adding other people (munshi, partner, accountant)
Settings → **Team access** → enter their Google email → **Editor** (can add/change entries) or **Viewer** (look + PDF only) → Add person.
They open the same link and sign in with that Google account. Remove them any time.

## Install like an app on the phone
* **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*.
* **iPhone (Safari):** Share → *Add to Home Screen*.
It opens full-screen and keeps working with a weak or no signal; entries sync when the network is back (the header shows **Saving… / Offline / Synced**).

## Moving data you already entered
If you used the earlier local-only version, open it, **Settings → Download backup**. After signing in on the cloud version, **Settings → Restore from file**.

## Good to know
* Free plan limits (50k reads / 20k writes per day) are comfortably enough for one site; the app caches data on your device to save reads.
* Prefer to keep the repo private? GitHub Pages on private repos needs a paid GitHub plan; otherwise keep it public — your data is not in the repo, only the app code.
* Check **Firebase console → Firestore → Data** if you ever want to see the raw records.
