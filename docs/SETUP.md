# Setup guide (about 15 minutes, one time)

The app runs in two modes:

| Mode | When | Data |
| --- | --- | --- |
| **Demo** | No Supabase keys in `public/config.js` | Stays in each browser. Comes pre-filled with sample data so you can try every screen. |
| **Shared** | Supabase keys filled in | One shared database for the whole squad, with logins, live updates and meal-plan file uploads. |

You need **Shared** mode to give the link to Stelios and Thanos. Both services below are free for a squad this size.

---

## 1. Publish the website (GitHub Pages)

1. **Get the code onto `main`.** Everything was pushed to the branch `claude/exciting-wozniak-pp8one`.
   On GitHub, open the repository and choose **one** of these:
   - If GitHub shows a yellow *“Compare & pull request”* banner, create the pull request and merge it into `main`.
   - Otherwise open **Settings → General → Default branch**, click the ⇄ icon, and rename the default branch to `main`.
2. Open **Settings → Pages**. Under *Build and deployment → Source*, choose **GitHub Actions**.
3. Open the **Actions** tab, choose **Deploy to GitHub Pages**, then click **Run workflow** (branch `main`).
   Wait for the green tick (about 2 minutes).
4. Your app is live at **https://dennis1kan.github.io/EimasteCoolTraining/**.
   It opens in demo mode until you finish step 2.

After this, every change pushed to `main` redeploys automatically.

## 2. Create the shared database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign in with GitHub, and click **New project**.
   - Name: `eimaste-cool` · Region: **Frankfurt (eu-central-1)**, the closest to Greece · Choose any database password and store it safely.
2. When the project is ready, open **SQL Editor → New query**.
   Paste the whole contents of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**.
   The result table lists the three members with their **join links**. Keep this tab open.
3. Open **Authentication → Sign In / Providers → Email** and switch **Confirm email** **off**, then save.
   The app signs people in with a password only. Nobody receives e-mail, so confirmation must be off.
   On the same page set **Minimum password length** to **8** (the app asks for at least 8 characters).
   Leave e-mail sending as it is: **don't set up custom SMTP** for this project. The logins use made-up
   addresses, and with custom SMTP Supabase would start mailing them (password resets, magic links).
4. Open **Project Settings → API**, or click **Connect** at the top. Copy these two values:
   - **Project URL**, e.g. `https://abcdxyz.supabase.co`
   - The **anon / public** key. Newer dashboards call it the **publishable** key.

   ⚠️ **Never** copy the **service_role** / **secret** key shown on the same page: it bypasses all security,
   and `config.js` is public. The app refuses to start with it. If it was ever published, roll it in the dashboard.

## 3. Connect the app to the database

1. On GitHub, open `public/config.js` and click the ✏️ **Edit** button.
2. Paste the two values:
   ```js
   window.ECT_CONFIG = {
     supabaseUrl: 'https://abcdxyz.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...',   // or sb_publishable_...
     authEmailDomain: '',                 // leave empty
   }
   ```
   `authEmailDomain` stays empty: logins then use your site's own address (`dennis1kan.github.io`) behind the
   scenes, a domain only you control. If you set it yourself, use a domain you own.
   Changing it later is safe: existing logins keep working.
3. Click **Commit changes** directly to `main`. The site redeploys by itself in about 2 minutes.

> Both values are meant to be public. The database protects itself with row-level security:
> only signed-in squad members can read anything, and each person can change only their own data.
> The coach is the exception and can manage everyone.

## 4. Join as the coach, then invite the squad

1. Take **Dennis's** join link from the SQL result (step 2.2). It looks like `#/join/dennis?code=ABCDEFGHJKLM`.
   Add it to the site address:
   `https://dennis1kan.github.io/EimasteCoolTraining/#/join/dennis?code=ABCDEFGHJKLM`
   Open it, choose a password, and you're in.
2. Open **Coach → Squad**. Each athlete has an invite link with **Copy** and **Share** buttons. Send Stelios and Thanos their links by WhatsApp or Viber.
   Each of them opens the link once and picks a password. After that, they sign in by tapping their name and typing that password.
3. Still in the coach console:
   - Set each athlete's **program start date** (yours too: the coach trains and competes like everyone else, unless you switch "Competes in leaderboards" off on your own profile). Week 1, day 1 is that date.
   - Add goals, goal weights and a coach note.
   - **Nutrition**: create a meal plan for each athlete. Add the foods of each meal from the built-in list (type in English or Greek) with their grams, and the app adds up kcal, protein, carbs and fat per meal and per day, next to your targets. Foods that are not in the list can be typed with their macros. You can also attach the PDF or photos from their nutritionist.
4. Tell everyone to **add the app to their home screen**. It then opens full-screen like a normal app and keeps working with a weak gym signal:
   - iPhone: Safari → Share → *Add to Home Screen*
   - Android: Chrome → ⋮ → *Install app*

   The welcome screen after joining shows these steps. The icon always opens the app itself, never the invite link
   (the link is used up once someone joins). On iPhone the icon keeps its own sign-in, separate from Safari:
   the first time, tap your name and type the password you picked.

### Weight privacy (tell the squad)
Each person picks in **Settings** how their body weight appears to the others:
- **Exact weight** (the default, full transparency): everyone sees their weigh-ins and trend.
- **Change only**: the squad screens show their progress (kg lost or gained, and %), never their weigh-ins.
  The exact numbers still reach the others' phones behind the scenes, so this is about what the app shows.
- **Private**: the database hides their weigh-ins from everyone except them and the coach.

Squads set up before this default changed keep what they had: each person can switch in **Settings**, and the coach
can switch "Competes in leaderboards" per member (himself included) in **Coach → Squad → (member)**.

### After an app update
Run [`supabase/schema.sql`](../supabase/schema.sql) again (SQL Editor → paste → **Run**). It is safe to re-run:
it keeps all data and brings the database rules up to date with the app.

### Someone forgot their password
Open **Coach → Squad → (member) → Reset login**. This makes a new invite link and signs out the old login.
Send them the new link and they choose a new password.

### Adding another friend later
Open **Coach → Squad → Add member**, then send the new member their invite link.

---

## Optional

- **Import your old logbook.** In the old BTS Logbook app, open *Menu → Export CSV*.
  Then in this app, open **Settings → Import from the old logbook** and pick that file.
- **A new program from the coach.** Open **Coach → Programs → Import**. It accepts the old logbook JSON format or a CSV.
  **Download template** gives you the exact CSV columns.
- **Back up everything.** Open **Coach → Programs → Export**, or **Settings → Export my data**.
- **Run it locally.**
  ```bash
  npm install
  npm run dev        # http://localhost:5173
  npm test           # unit tests
  npm run build      # production build in dist/
  ```
- **Test the database rules locally.** You need PostgreSQL 16. Run `bash scripts/test-db.sh`.
