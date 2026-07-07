# Burmelin Finance — Mobile App

A phone-friendly web app for your **Burmelin_Finance_NewX** Google Sheet:

- **Dashboard** — total cash & bank, every shop's drawer, every credit customer's balance, all on one screen
- **Record** — a smart entry form that writes rows straight into Master Entry, following the same double-entry rules as the sheet

---

## One-time setup (about 15 minutes)

### Step 1 — Create a Google service account (you must do this yourself)

This creates a "robot" Google account the app uses to read/write your sheet.

1. Go to https://console.cloud.google.com (sign in with burmelinco@gmail.com)
2. Top bar → project dropdown → **New Project** → name it `burmelin-finance` → Create
3. Menu → **APIs & Services → Library** → search **Google Sheets API** → **Enable**
4. Menu → **APIs & Services → Credentials** → **Create Credentials → Service account**
   - Name: `sheet-writer` → Create and continue → skip the optional steps → Done
5. Click the service account you just made → **Keys** tab → **Add key → Create new key → JSON** → Download.
   Keep this file safe — it is the key to your sheet.
6. Open the JSON file in Notepad. You need two values:
   - `client_email` (looks like `sheet-writer@burmelin-finance.iam.gserviceaccount.com`)
   - `private_key` (the long block starting `-----BEGIN PRIVATE KEY-----`)
7. **Share the spreadsheet with the robot:** open Burmelin_Finance_NewX → Share → paste the
   `client_email` address → role **Editor** → Send (untick "notify" if offered).

### Step 2 — Deploy to Vercel (you must create/log into the account yourself)

1. Create a free account at https://vercel.com (sign up with GitHub, Google, or email)
2. In a terminal, from this folder (`burmelin-finance-app`):
   ```
   npx vercel login
   npx vercel --prod
   ```
   Accept the defaults when it asks questions.
3. In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `SHEET_ID` | `1UG4WQG3vOiytArJT1U03CdQPwjPlMb9-3wy1OGzoLmw` |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` from the JSON |
   | `GOOGLE_PRIVATE_KEY` | the `private_key` from the JSON (paste the whole thing, including BEGIN/END lines) |
   | `APP_PIN` | any PIN you like, e.g. `4832` (recommended — the URL is public otherwise) |

4. Redeploy so the variables take effect: `npx vercel --prod` again.
5. Open the URL it gives you in Safari → Share button → **Add to Home Screen**. Done — it now
   behaves like an app.

---

## Running locally (for testing)

```
npm install
npm run dev
```

Open http://localhost:3000. Without credentials it runs in **mock mode** (sample numbers,
saves don't write). To test against the real sheet locally, create a `.env` file here:

```
SHEET_ID=1UG4WQG3vOiytArJT1U03CdQPwjPlMb9-3wy1OGzoLmw
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheet-writer@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_PIN=4832
```

**Never commit or share the private key or `.env` file.**

---

## How writing works (so future-you trusts it)

- The app finds the first empty row in Master Entry (by column A) and writes columns
  **A–D and F–L** only. Column **E (Type)** and columns **M/N (collection reconciliation)**
  contain formulas and are never touched.
- Credit Sale / Customer Payment entries force **Shop = Palladium**, same as the sheet's rules.
- Every entry is tagged `App` in the *Entered By* column so you can tell app entries from
  manual ones.
- The dashboard computes balances with the same logic as the sheet's Dashboard tab
  (collections move cash to Palladium; bank is one shared account).
