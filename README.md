# Site Ledger — construction accounts website

A static website (HTML + CSS + JS, no server, no build step) for tracking a building site's accounts:
bricks, sand, aggregate, steel (with day-wise usage), soil filling, contractor payments, salary,
credit shop, munshi cash register, creditor funding, local labour, labour head and cement stock.

* **Dashboard** – totals, paid vs due, spend by head, stock (cement, steel by size), munshi cash, contractor taken.
* **Records** – every section in one scrolling page, searchable, each with its own **PDF** button (plus a **Full PDF**).
* **Update** – form per section with live validation, auto-calculated totals, edit / delete, and a **₹ button** to record a later payment on a due bill.
* **Steel** – click any size (8 / 10 / 12 / 16 mm) to open a popup showing stock, which day it was used and on what work.
* **Settings** – names, contract value, backup / restore.

## Put it online (GitHub Pages, free)

1. Create a new repository on GitHub (e.g. `site-ledger`).
2. Upload these files to the repo root: `index.html`, `styles.css`, `app.js` (and optionally `data.json`).
3. Repo → **Settings → Pages** → *Deploy from a branch* → branch `main`, folder `/ (root)` → Save.
4. After a minute your site is live at `https://<your-username>.github.io/site-ledger/`.

## How data is stored (important)

GitHub Pages hosts only static files, so entries are saved **in the browser you type them in**.

* Use **Settings → Download backup** regularly.
* To let other people / other devices see the same numbers: **Settings → Download data.json**, then upload it to the repo
  (replace the old `data.json`). Anyone opening the site on a fresh browser automatically loads it.
  To refresh a browser that already has data, use **Settings → Reload published data.json**.

## Accounting rules used

* Each purchase bill has *Total* and *Paid*. Paid < Total → **Due**; Paid > Total → **Advance**; equal → **Paid**.
  To record an advance before the material arrives, enter Paid with Total empty, then edit the row when the bill comes.
* Bricks rate is per 1000 bricks; sand/soil rate is per trip; steel rate is per bundle.
* Cash given to the munshi is *not* an expense; what he spends is. (No double counting.)
* Creditor funding is shown separately as money received / repaid, not as expenditure.

PDFs need the internet once per page load (jsPDF is loaded from a CDN).
