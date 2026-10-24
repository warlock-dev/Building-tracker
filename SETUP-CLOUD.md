# Cloud setup — open access, no sign-in (≈5 minutes)

Anyone who has the website link can open it and edit. All data is stored in **your Firebase project's Firestore database**
(not inside anybody's Google account), so it is the same on every phone and computer.

## Do this once
1. **Firestore rules** — Firebase console → *Build → Firestore Database → Rules* tab → delete everything →
   paste the contents of **`firestore.rules`** from this folder → **Publish**.
   (No Authentication step is needed any more. You can ignore "Authentication" and "Authorized domains".)
2. **Upload the files** to your GitHub repo (replace the old ones): `index.html`, `styles.css`, `app.js`, `config.js`, `sw.js`,
   `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`. Wait a minute for GitHub Pages to refresh.
3. Open your site (hard-refresh once: Ctrl+Shift+R, or reopen the tab on the phone).
   Press **Open ledger**. The first time on a device it also offers an optional name box.
4. **Settings → Restore from file** → choose `health-care-building-data.json` to load your workbook data into the cloud.

## How it behaves
* The welcome box appears once per device. **Open ledger** goes straight in; typing a name first is optional.
  The name (tap the 👤 chip at the top to change it) is stored on each entry — hover a row to see who entered it.
* Works offline; changes sync when the network returns (header shows *Saving… / Offline / Synced*).
* Anyone with the link can edit or delete — share the link only with people you trust, and use **Settings → Download backup** now and then.
  If you ever want a lock, tell me and I'll add a shared passcode.
