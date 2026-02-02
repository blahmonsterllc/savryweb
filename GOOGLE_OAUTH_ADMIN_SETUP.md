# Google OAuth Admin Authentication Setup

Your admin panel is now protected by Google OAuth! Only authorized Google accounts can access admin features.

---

## ✅ What's Been Updated

1. **Google OAuth Integration** - Admin login now uses Google Sign-In
2. **Email Whitelist** - Only specific emails can access admin area
3. **NextAuth Configuration** - Secure session management with JWT
4. **Updated Middleware** - Checks Google OAuth sessions instead of simple password
5. **Improved Login Page** - Beautiful Google Sign-In button

---

## 🔧 Required Setup Steps

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** (or People API)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - Application name: `Savry Admin`
   - User support email: `savryapp@gmail.com`
   - Authorized domains: Add your production domain
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Savry Admin Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
7. Copy the **Client ID** and **Client Secret**

### 2. Update Environment Variables

Add these to your `.env.local` (development) and production environment:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here

# NextAuth Secret (generate a random string)
NEXTAUTH_SECRET=your-random-secret-here

# NextAuth URL (your app's base URL)
NEXTAUTH_URL=http://localhost:3000  # For development
# NEXTAUTH_URL=https://yourdomain.com  # For production
```

Generate a secure `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

Or in Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Add Authorized Admin Emails

Edit `/lib/auth-config.ts` to add authorized admin emails:

```typescript
const ADMIN_EMAILS = [
  'savryapp@gmail.com',
  'another-admin@gmail.com',  // Add more as needed
]
```

---

## 🔒 Security Features

- ✅ **OAuth 2.0** - Industry-standard secure authentication
- ✅ **Email Whitelist** - Only specific Google accounts can access
- ✅ **JWT Sessions** - Secure, stateless session management
- ✅ **7-Day Session** - Auto-logout after 7 days
- ✅ **HttpOnly Cookies** - Protected from XSS attacks
- ✅ **CSRF Protection** - Built into NextAuth

---

## 🚀 Testing the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit: `http://localhost:3000/admin`

3. You should be redirected to `/admin/login`

4. Click "Sign in with Google"

5. Sign in with `savryapp@gmail.com` or another authorized email

6. You'll be redirected to the admin dashboard

---

## 🛡️ What Happens When

### ✅ Authorized Email Signs In
- Redirected to admin dashboard
- Can access all admin features
- Session lasts 7 days

### ❌ Unauthorized Email Tries to Sign In
- Sign-in blocked by NextAuth callback
- Redirected back to login with "Access Denied" error
- Cannot access any admin features

### 🚫 No Session
- All `/admin/*` routes redirect to `/admin/login`
- All protected API routes return 401 Unauthorized
- iOS APIs remain unaffected (still public)

---

## 📱 Protected Routes

The following require Google OAuth admin authentication:

### Web Pages
- `/admin` - Admin dashboard
- `/admin/*` - All admin pages (except `/admin/login`)
- `/health` - Health monitoring dashboard

### API Routes
- `/api/admin/*` - Admin API endpoints
- `/api/health` - Health check API
- All other `/api/*` routes (except `/api/app/*` for iOS and `/api/auth/*` for NextAuth)

### ✅ Public Routes (No Auth Required)
- `/` - Homepage and marketing pages
- `/api/app/*` - iOS app APIs
- `/api/auth/*` - NextAuth authentication endpoints
- `/admin/login` - Admin login page

---

## 🔄 Migration from Old Password System

The old password-based system files are still present but **no longer used**:

- `lib/admin-session.ts` - Old HMAC session tokens
- `pages/api/admin/login.ts` - Old password login
- `pages/api/admin/logout.ts` - Old logout

You can keep these as backup or delete them:

```bash
# Optional: Remove old auth files
rm lib/admin-session.ts
rm pages/api/admin/login.ts
rm pages/api/admin/logout.ts
```

**Environment variables you can remove:**
- `ADMIN_PASSWORD` - No longer needed
- `ADMIN_SESSION_SECRET` - No longer needed

---

## 🐛 Troubleshooting

### "Access Denied" Error
- Check that your email is in the `ADMIN_EMAILS` list in `/lib/auth-config.ts`
- Emails are case-insensitive but must match exactly

### "Configuration Error"
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check that `NEXTAUTH_SECRET` is set and not empty
- Ensure `NEXTAUTH_URL` matches your actual domain

### OAuth Redirect Error
- Verify redirect URIs in Google Console match exactly
- Format: `http://localhost:3000/api/auth/callback/google`
- Don't forget the `/api/auth/callback/google` path

### Session Not Persisting
- Check that cookies are enabled in your browser
- Verify `NEXTAUTH_SECRET` is the same across all servers
- In production, ensure you're using HTTPS

---

## 🔐 Production Checklist

Before deploying:

- [ ] Add production domain to Google OAuth authorized origins
- [ ] Add production callback URL to Google OAuth redirect URIs
- [ ] Set `NEXTAUTH_URL` to production domain (with https://)
- [ ] Use a secure, random `NEXTAUTH_SECRET` (32+ characters)
- [ ] Add all admin emails to `ADMIN_EMAILS` list
- [ ] Remove old password-based auth files (optional)
- [ ] Test login with all authorized accounts
- [ ] Test that unauthorized accounts are blocked

---

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth Google Provider](https://next-auth.js.org/providers/google)

---

## 🎉 Benefits of Google OAuth

1. **Better Security** - No password to remember or store
2. **Two-Factor Auth** - Leverage Google's 2FA automatically
3. **Easy Management** - Add/remove admin access by email
4. **Audit Trail** - Google logs all sign-in attempts
5. **Professional** - Modern authentication UX
6. **Mobile Friendly** - Works seamlessly on all devices

---

Your admin panel is now protected by Google OAuth! 🔒✨
