# Admin Setup (No Public User Logins)

This repo is currently configured to:

- ✅ **Disable public user login/registration**
- ✅ Keep **iOS APIs working** under `GET/POST/etc /api/app/*`
- ✅ Lock down web dashboards + non‑iOS APIs behind an **admin login**

---

## Admin URLs

- **Admin login**: `/admin/login`
- **Admin home**: `/admin`
- **Health dashboard**: `/health` (admin-only)
- **Health JSON**: `/api/health` (admin-only)

---

## Required environment variables

Add these to your server environment (for local dev, put them in `.env.local`):

```bash
# Required: used to sign/verify the admin session cookie (server-side only)
ADMIN_SESSION_SECRET=replace-with-a-long-random-string

# Required: admin password for /admin/login
ADMIN_PASSWORD=replace-with-a-strong-password
```

Generate a strong secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## How the lock-down works

- **Allowed without admin**
  - Public marketing pages (ex: `/`)
  - iOS endpoints: **`/api/app/*`**
  - Admin auth endpoints: **`/api/admin/*`**

- **Admin-only**
  - `/admin/*` (except `/admin/login`)
  - `/dashboard/*`
  - `/health`
  - `/api/*` (everything else besides `/api/app/*` and `/api/admin/*`)

---

## Notes

- If `ADMIN_SESSION_SECRET` or `ADMIN_PASSWORD` is missing, `/api/admin/login` will fail (server error).
- `/api/health` reports which env vars are set (booleans only; it never reveals secret values).



