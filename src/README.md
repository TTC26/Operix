# Bizvora

Detailed Project Reports (DPR), bank / MSME loan appraisal and CMA data, with a live financial engine. Works in any currency. Runs in the browser and installs on phones as an app (PWA).

## Modes
1. **General DPR** – project report for startups, investors and subsidy files
2. **Bank / MSME DPR** – adds loan schedule, DSCR, ratios, sensitivity and appraisal
3. **Bank / MSME + CMA** – adds historical financials, GST / ITR / bank reconciliation, CMA Forms II–VI and MPBF

## Deploy on Vercel (via GitHub)
1. Create an empty GitHub repository named `bizvora` and push this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/bizvora.git
   git branch -M main
   git push -u origin main
   ```
2. On vercel.com, go to **Add New → Project**, import `bizvora`, and click **Deploy**.
   - Framework preset: **Other**. You don't need a build command.

## Accounts and per-user projects (Firebase, free Spark plan)
Email sign-in and each user's project dashboard use Firebase Authentication + Cloud Firestore. Without this setup the app runs in *local mode*: no sign-in, and projects are saved in the browser.

1. Go to console.firebase.google.com → **Add project**. Name it `bizvora`. Google Analytics is optional.
2. **Build → Authentication → Get started → Sign-in method:**
   - Turn on **Email/Password**.
   - Also turn on **Email link (passwordless sign-in)** in the same panel.
3. Under **Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `bizvora.vercel.app`) and any custom domain.
4. **Build → Firestore Database → Create database.** Pick a location close to your users (e.g. `asia-south1` Mumbai) and start in **production mode**.
5. In Firestore, open **Rules**. Replace everything with the contents of `firestore.rules` and click **Publish**.
6. Open **Project settings → General → Your apps → Web (</>)**. Register the app (no Hosting needed) and copy the `firebaseConfig = { ... }` block.
7. In Vercel → **Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `FIREBASE_CONFIG` | Paste the whole `{ apiKey: ..., authDomain: ..., projectId: ..., appId: ... }` block |
   | `ANTHROPIC_API_KEY` | optional, turns on AI drafting (billed per use) |
   | `ANTHROPIC_MODEL` | optional, a current model id from https://docs.claude.com/en/docs/about-claude/models |

   Then **Redeploy**.

Sign-in options: email + password (a verification email is sent), an email sign-in link, and password reset. Firebase sends these emails itself, so you don't need an email service. You can change the wording under **Authentication → Templates**. When accounts are on, `/api/ai` only answers signed-in users.

### Keeping it free
- The Firebase **Spark** plan needs no card and never pauses. It has daily usage quotas, which are far above what a new app uses.
- AI is optional. Leave `ANTHROPIC_API_KEY` unset and the app hides the AI buttons.
- Hosting: the free Vercel Hobby plan is meant for personal, non-commercial projects. Check the terms before you charge users.

Every push to `main` redeploys automatically.

## Payments — pay per report (Razorpay)
The Excel model is free. The PDF + Word report for a project unlocks after one payment: Mode 1 ₹599, Mode 2 ₹999, Mode 3 ₹1,499. Moving a paid project to a higher mode costs only the difference. Unlocks are written only by the server after Razorpay's signature is verified (`api/pay/*`), and users can't write them (`firestore.rules`).

1. **Fill in the policy pages.** Open `pricing.html`, `terms.html`, `privacy.html`, `refund.html`, `contact.html` and replace every `[...]` placeholder with your business name, address, email, phone, city and date. Razorpay checks these pages during activation. Have them reviewed if you're unsure; they are a starting template, not legal advice.
2. **Create a Razorpay account** at razorpay.com. Test mode works right away, before KYC.
3. In Razorpay Dashboard → **Account & Settings → API Keys** (test mode), generate a key. You get a Key ID (`rzp_test_…`) and a Key Secret.
4. In Firebase → **Project settings → Service accounts → Generate new private key**. A JSON file downloads. Keep it secret.
5. In Vercel → **Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `RAZORPAY_KEY_ID` | `rzp_test_…` (later `rzp_live_…`) |
   | `RAZORPAY_KEY_SECRET` | the key secret |
   | `FIREBASE_SERVICE_ACCOUNT` | the whole contents of the downloaded JSON file |
   | `PRICE_MODE1`, `PRICE_MODE2`, `PRICE_MODE3` | optional, prices in rupees (defaults 599 / 999 / 1499) |

   Then redeploy.
6. **Re-publish `firestore.rules`** in Firebase → Firestore → Rules. It now includes the `unlocks` rule.
7. **Test:** open a saved project → **Unlock report** → pay with Razorpay's test UPI or test card. The report unlocks and the download starts.
8. **Go live:** finish KYC in Razorpay (PAN, bank account, business details, website with the policy pages). Then generate live keys, replace both `RAZORPAY_*` values in Vercel, and redeploy. Also update the prices on `pricing.html` if you change them.

Note: the PDF and Word files are generated in the browser. The payment check stops normal users, but a technical user could bypass it by editing the page code. Server-side report generation is the step that closes this.

## Professional PDF report
- **DPR report (.pdf)** is rendered on the server by `api/report.py` (Python + ReportLab) from the data built in `js/reportpro.js`.
- It includes a cover page (with the first product photo), a contents page with page numbers and clickable links, numbered sections, a project-at-a-glance table, KPI boxes, charts (revenue/EBITDA/PAT, DSCR vs benchmark, break-even, cost and finance donuts), a process-flow diagram, product photos, SWOT, an implementation Gantt chart, landscape annexures for the full statements and CMA data, page headers and "Page x of y" footers.
- Product photos and descriptions are added in **Products & capacity → Product photos and descriptions**. Photos are resized in the browser (about 20–80 KB each).
- The server checks the unlock (or full access) before rendering, so the paid PDF can't be produced from the browser alone.
- Fonts: Carlito and Poppins (SIL Open Font License) in `fonts/`. Python dependencies are in `requirements.txt`; `vercel.json` bundles `fonts/` with the function.
- In local development without the Python function, the app falls back to the basic browser PDF.

## Admin panel
- Sign in as an admin, then open the account menu (top right) → **Admin panel**.
- Admins are set by `ADMIN_EMAILS` in Vercel (comma-separated). If it is not set, `info.bizvora@gmail.com` is the admin. An admin's email must be verified.
- **Give full access** to any email: all of that person's reports unlock free (PDF + Word), with no payment. You can add an email before the person signs up. Access applies only after they sign in with that email verified.
- The panel lists every user with verified status, projects, paid reports, join date and last sign-in.
- Grants are stored in Firestore `grants/{email}` and written only by the server (`api/admin.js`). The Firestore rules block all client access to them.

## SEO
- `/` is a static landing page (`index.html`) with title, description, Open Graph image (`icons/og-image.png`), and structured data (SoftwareApplication, Organization, FAQ).
- The app moved to `/app` (`app.html`, not indexed). `/app?example` opens the example without an account; `/app?signup` opens Create account.
- Guide pages for search: `/dpr-for-bank-loan`, `/cma-data`, `/msme-loan-project-report`.
- `robots.txt` and `sitemap.xml` list the public pages. All URLs use `https://bi-zvora.vercel.app`. If you add a custom domain, replace it in `index.html`, the guide pages, the policy pages, `robots.txt` and `sitemap.xml`.
- Submit `sitemap.xml` in Google Search Console after deploying.

## Run locally
```bash
npm run dev     # serves on http://localhost:3000
npm test        # checks the financial engine (balance sheet, cost = means, DSCR)
```

## Structure
| Path | What it is |
| --- | --- |
| `index.html` | App shell |
| `css/styles.css` | Theme: white, lime, mint and pink, plus dark mode |
| `js/engine.js` | Financial engine: sales, opex, WC, depreciation, loans, P&L, BS, cash flow, ratios, DSCR, BEP, IRR, MPBF |
| `js/example.js` | Example project + blank project template |
| `js/ui-core.js` | State, currencies, formatting, form and chart helpers |
| `js/views.js` | Screens |
| `js/report.js` | Checks, report model, Excel / PDF / Word export, AI, saving |
| `js/store.js` | Accounts (Firebase Auth) and project storage (Firestore), with local fallback |
| `js/account.js` | Sign-in screens, projects dashboard, new-project wizard |
| `js/payments.js` | Unlock dialog, Razorpay checkout, payment verification |
| `js/reportpro.js` | Builds the professional report data; product photo upload |
| `api/report.py` | Server-side PDF renderer (ReportLab) with unlock check |
| `js/admin.js` | Admin panel: users list and full-access grants |
| `js/main.js` | Layout, events, start-up, AI client, service worker registration |
| `api/ai.js` | Vercel function that calls the Anthropic API (requires sign-in when accounts are on) |
| `api/config.js` | Gives the browser the public Firebase web config |
| `api/pay/*.js`, `api/_razorpay.js`, `api/_admin.js`, `api/_pricing.js` | Razorpay order + verification; unlocks written with Firebase Admin |
| `pricing.html`, `terms.html`, `privacy.html`, `refund.html`, `contact.html` | Policy pages needed for payment-gateway activation (fill in the placeholders) |
| `api/admin.js`, `api/access.js`, `api/_access.js` | Admin list/grant API and the current user's access check |
| `firestore.rules` | Security rules: each user reads and writes only their own projects |
| `vendor/` | Firebase SDK, SheetJS, jsPDF, jsPDF-AutoTable, docx (see THIRD_PARTY_NOTICES.md) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app + offline shell |

## Current limits (prototype)
- `/api/ai` needs sign-in when Firebase is configured, but has no per-user rate limit yet.
- The Excel model contains values, not live formulas.
- The PDF uses the built-in Helvetica font, so ₹ prints as "Rs.".
