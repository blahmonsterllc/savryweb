# Admin Setup - Google OAuth Authentication

This repo is configured to:

- ✅ **Disable public user login/registration**
- ✅ Keep **iOS APIs working** under `GET/POST/etc /api/app/*`
- ✅ Lock down web dashboards + non‑iOS APIs behind **Google OAuth admin login**
- ✅ **Email whitelist** - Only specific Google accounts can access admin

---

## Admin URLs

- **Admin login**: `/admin/login` (Google OAuth)
- **Admin home**: `/admin`
- **Health dashboard**: `/health` (admin-only)
- **Health JSON**: `/api/health` (admin-only)

---

## 🔧 Setup Instructions

See **[GOOGLE_OAUTH_ADMIN_SETUP.md](./GOOGLE_OAUTH_ADMIN_SETUP.md)** for complete setup guide.

### Quick Start

1. **Create Google OAuth App** in Google Cloud Console
2. **Add Environment Variables:**

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth Configuration
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000  # or your production URL
```

3. **Add Admin Emails** in `/lib/auth-config.ts`:

```typescript
const ADMIN_EMAILS = [
  'savryapp@gmail.com',
  // Add more authorized emails
]
```

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud Console |
| `NEXTAUTH_SECRET` | Random secret for JWT signing (32+ chars) |
| `NEXTAUTH_URL` | Your app's base URL |

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

---

## How the Lock-Down Works

- **Allowed without admin**
  - Public marketing pages (ex: `/`)
  - iOS endpoints: **`/api/app/*`**
  - Auth endpoints: **`/api/auth/*`** (NextAuth)

- **Admin-only** (requires Google OAuth)
  - `/admin/*` (except `/admin/login`)
  - `/health`
  - `/api/admin/*`
  - Most `/api/*` (except `/api/app/*` and `/api/auth/*`)

---

## Security Features

- ✅ **Google OAuth 2.0** - Industry standard authentication
- ✅ **Email Whitelist** - Only authorized accounts can access
- ✅ **JWT Sessions** - Secure, stateless session management
- ✅ **Auto-Logout** - Sessions expire after 7 days
- ✅ **CSRF Protection** - Built into NextAuth

---

## Notes

- Only emails listed in `ADMIN_EMAILS` can access admin features
- Google OAuth automatically handles 2FA if enabled on the account
- Sessions are secure and can't be tampered with
- Old password-based system has been replaced with OAuth

---

For detailed setup instructions, see **[GOOGLE_OAUTH_ADMIN_SETUP.md](./GOOGLE_OAUTH_ADMIN_SETUP.md)**



