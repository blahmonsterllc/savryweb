# Admin sign-in, activity log, and traffic

The admin area (`/admin`, `/api/admin`) has three locks, checked in this order on
every request, first in `middleware.ts` and again inside every `/api/admin`
handler (`lib/admin-session.ts`):

1. **Cloudflare Access.** Cloudflare asks for its own sign-in (a one-time code by
   email, or Google/GitHub if you add them) before the request reaches Vercel,
   then passes a signed token along. The site checks that token
   (`lib/cloudflare-access.mjs`), so going around Cloudflare through the
   `*.vercel.app` address does not work: pages are sent to www.savry.io, and API
   calls are refused.
2. **Your Savry account** (Apple or email sign-in), on the admin list
   (`public.admin_users`).
3. **Two-factor.** A 6-digit code from an authenticator app. The database's
   `is_admin()` answers true only for a session that has had the second factor
   (Supabase marks it `aal2` in its signed token), so nothing on the site can
   skip it.

Everything an admin does is written to the **activity log** at `/admin/activity`.

## Order to switch it on

Do these in order, so you are never locked out:

1. **Deploy the code.** Admin works as before.
2. **Set up your authenticator.** Open `https://www.savry.io/admin/two-factor`,
   scan the QR code with 1Password, Apple Passwords, Google Authenticator or
   Authy, and enter the code. Every admin does this.
3. **Apply the database migration**
   `supabase/migrations/20261121000000_admin_sign_in_security.sql`
   (`supabase db push`, or paste it into the Supabase SQL editor). From now on,
   admin pages need the code.
4. **Turn on Cloudflare Access** (below).
5. **Turn on visit counts** (below).
6. Open `/admin/security`. "Cloudflare Access sign-in protects the admin area"
   and "Every admin has two-factor sign-in set up" should both be green.

## Cloudflare Access

Before you start: in Cloudflare DNS, the `www` record for savry.io must be
**Proxied** (orange cloud), and SSL/TLS mode must be **Full (strict)**. Access
only sees traffic that goes through Cloudflare.

1. Open Cloudflare Zero Trust (one.dash.cloudflare.com). The first time, it asks
   for a team name. Your team domain is `<team-name>.cloudflareaccess.com`.
2. **Settings → Authentication → Login methods.** "One-time PIN" (a code by email)
   is on by default. Add Google or GitHub if you prefer.
3. **Access → Applications → Add an application → Self-hosted.**
   - Name: `Savry admin`. Session duration: 24 hours or less.
   - Public hostname: `www.savry.io`, path `admin`.
   - Add a second hostname: `www.savry.io`, path `api/admin`.
   - Policy: action **Allow**, Include → **Emails** → the admins' email addresses.
4. Save, open the application, and copy the **Application Audience (AUD) Tag**.
5. In Vercel → Settings → Environment Variables (Production), add:
   - `CLOUDFLARE_ACCESS_TEAM_DOMAIN` = `<team-name>.cloudflareaccess.com`
   - `CLOUDFLARE_ACCESS_AUD` = the AUD tag

   Then redeploy.
6. Check it in a private window: `https://www.savry.io/admin` shows Cloudflare's
   sign-in first, and `https://savryweb.vercel.app/admin` goes to www.savry.io.

Leave everything else out of the Access application. The scheduled jobs
(`/api/cron/*`), Apple's purchase notifications (`/api/app-store/notifications`)
and the iOS app's routes are outside `/admin` and must stay reachable.

Cloudflare logs every sign-in attempt, passed or failed, under Zero Trust →
**Logs → Access**.

## Two-factor

- Supabase has authenticator-app (TOTP) two-factor switched on by default. You
  can confirm under Supabase → Authentication → Multi-Factor.
- After signing in with Apple or email, a listed admin is sent to
  `/admin/two-factor` for the code. Admin pages and the admin API refuse a session
  without it.
- **Lost phone:** another admin removes your authenticator in Supabase →
  Authentication → Users → your account (or runs
  `delete from auth.mfa_factors where user_id = '<your user id>';` in the SQL
  editor), and you set it up again at `/admin/two-factor`.
- Adding an admin: insert their user id into `public.admin_users` with the SQL
  editor. Then they set up two-factor on their first visit.

## Activity log

`/admin/activity` lists, newest first:

- each admin sign-in (once per session), with the sign-in methods, IP address and browser
- every change made in admin: bans and unbans, moderation decisions, patrol
  decisions and manual runs, recipe edits, deletions, visibility and editor's picks,
  and test emails
- every member search (searches show email addresses)
- every time a signed-in member who is not an admin tried to open admin
  (at most one entry per account every ten minutes)

The table is `public.admin_activity`. No browser session can read or write it,
the server can only append through `admin_log_action`, `note_admin_session` and
`note_admin_denied`, and a trigger refuses every update, delete and truncate.

Other logs:
- **Cloudflare:** Zero Trust → Logs → Access (who passed or failed Cloudflare's sign-in)
- **Supabase:** Authentication → Logs (every sign-in)
- **Vercel:** the project's Logs tab (server errors)

## Visit counts (Cloudflare Web Analytics)

Cookie-free: no cookies, no cross-site tracking, no profiles. It counts public
pages only and is never loaded on admin pages. It is described in the privacy
policy.

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** →
   `www.savry.io`. Choose the **JavaScript snippet** option (not automatic setup,
   which would count every visit twice) and copy the `token` value from the snippet.
2. In Vercel, add `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` = that token.
   Visits are counted from the next deploy on. The site's security policy allows
   Cloudflare's script only while this is set.
3. For the numbers on the admin overview, create an API token: Cloudflare →
   My Profile → API Tokens → Create Custom Token, with permission **Account →
   Account Analytics → Read** and nothing else. In Vercel, add:
   - `CLOUDFLARE_API_TOKEN` = the token (secret: server only)
   - `CLOUDFLARE_ACCOUNT_ID` = your account id (in the dashboard URL)
   - `CLOUDFLARE_WEB_ANALYTICS_SITE_TAG`: only if the account counts more than one site
4. Redeploy. The overview's "Traffic, last 7 days" shows visits, page views, top
   pages, where visitors came from, and countries.

## Environment variables added

| Variable | Secret | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | no | Cloudflare Access team, e.g. `savry.cloudflareaccess.com` |
| `CLOUDFLARE_ACCESS_AUD` | no | the Access application's audience tag |
| `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | no (public) | the visit counter |
| `CLOUDFLARE_ACCOUNT_ID` | no | for reading visit counts |
| `CLOUDFLARE_API_TOKEN` | **yes** | Account Analytics Read only; server only |
| `CLOUDFLARE_WEB_ANALYTICS_SITE_TAG` | no | optional |
