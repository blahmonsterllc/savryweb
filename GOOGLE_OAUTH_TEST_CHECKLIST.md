# Google OAuth Admin - Testing Checklist

Quick checklist to verify your Google OAuth admin setup is working correctly.

---

## ✅ Pre-Flight Checklist

Before testing, ensure:

- [ ] Google Cloud Console OAuth app is created
- [ ] Redirect URIs are configured correctly in Google Console
- [ ] All environment variables are set in `.env.local`
- [ ] `savryapp@gmail.com` is in the `ADMIN_EMAILS` list
- [ ] Server has been restarted after adding env vars

---

## 🧪 Test Scenarios

### 1. Authorized Admin Access ✅

**Test:** Sign in with authorized email (savryapp@gmail.com)

```bash
1. Visit http://localhost:3000/admin
2. Should redirect to /admin/login
3. Click "Sign in with Google"
4. Select savryapp@gmail.com
5. Should redirect to /admin dashboard
6. Should see health stats, charts, etc.
```

**Expected:** ✅ Access granted, can view all admin features

---

### 2. Unauthorized Account Blocked ❌

**Test:** Sign in with unauthorized email

```bash
1. Visit http://localhost:3000/admin
2. Should redirect to /admin/login
3. Click "Sign in with Google"
4. Select a different email (not in ADMIN_EMAILS)
5. Should redirect back to /admin/login with error
```

**Expected:** ❌ Access denied, error message shows

---

### 3. Direct Admin Route Access 🔒

**Test:** Access admin routes without signing in

```bash
1. Open incognito/private window
2. Visit http://localhost:3000/admin
3. Should redirect to /admin/login
4. Try http://localhost:3000/health
5. Should redirect to /admin/login
```

**Expected:** 🔒 All admin routes protected, redirect to login

---

### 4. API Protection 🛡️

**Test:** Call protected API routes

```bash
# Test admin API without auth
curl http://localhost:3000/api/health

# Expected: 401 Unauthorized
{"message":"Admin authorization required"}
```

**Expected:** 🛡️ API returns 401 for unauthenticated requests

---

### 5. iOS APIs Still Public ✅

**Test:** iOS app endpoints remain accessible

```bash
# These should work without auth
curl http://localhost:3000/api/app/sync/private-recipes
curl http://localhost:3000/api/app/meal-plans
curl http://localhost:3000/api/app/transcribe

# Expected: Normal API responses (not 401)
```

**Expected:** ✅ iOS APIs work without authentication

---

### 6. Logout Functionality 🚪

**Test:** Sign out successfully

```bash
1. Sign in to /admin
2. Click "Logout" button
3. Should redirect to homepage (/)
4. Try to visit /admin again
5. Should redirect to /admin/login
```

**Expected:** 🚪 Session cleared, need to re-authenticate

---

### 7. Session Persistence 💾

**Test:** Session survives page refresh

```bash
1. Sign in to /admin
2. Refresh the page (Cmd+R / Ctrl+R)
3. Should stay logged in
4. Close tab and reopen /admin
5. Should still be logged in (within 7 days)
```

**Expected:** 💾 Session persists across page loads

---

### 8. Multiple Admin Emails 👥

**Test:** Add and test multiple admin accounts

```typescript
// In /lib/auth-config.ts, add another email
const ADMIN_EMAILS = [
  'savryapp@gmail.com',
  'another-admin@gmail.com',
]
```

```bash
1. Restart server
2. Sign in with 'another-admin@gmail.com'
3. Should have full admin access
```

**Expected:** 👥 All listed emails can access admin

---

## 🐛 Common Issues & Solutions

### Issue: "Configuration" error on login

**Solution:**
```bash
# Check these env vars are set
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
echo $NEXTAUTH_SECRET
echo $NEXTAUTH_URL
```

---

### Issue: Redirect URI mismatch

**Solution:**
- Go to Google Cloud Console
- Check redirect URIs match exactly:
  - `http://localhost:3000/api/auth/callback/google`
  - No trailing slashes
  - Protocol matches (http vs https)

---

### Issue: "Access Denied" for authorized email

**Solution:**
```typescript
// Check email is in list (case-insensitive)
// In /lib/auth-config.ts
const ADMIN_EMAILS = [
  'savryapp@gmail.com',  // ✅ Make sure it's here
]
```

---

### Issue: Session not persisting

**Solution:**
- Check browser allows cookies
- Verify `NEXTAUTH_SECRET` is set
- In production, ensure you're using HTTPS

---

## 📊 Success Criteria

All tests should pass with these results:

- ✅ Authorized emails can access admin
- ❌ Unauthorized emails are blocked
- 🔒 All admin routes require authentication
- 🛡️ Admin APIs return 401 without auth
- ✅ iOS APIs remain public
- 🚪 Logout clears session properly
- 💾 Sessions persist across refreshes
- 👥 Multiple admin emails work

---

## 🎉 You're Done!

If all tests pass, your Google OAuth admin authentication is working perfectly!

Your admin panel is now secured with:
- ✅ Industry-standard OAuth 2.0
- ✅ Email-based access control
- ✅ Secure JWT sessions
- ✅ Automatic 2FA support (via Google)

---

## 📝 Notes

- Sessions last 7 days by default
- You can modify session duration in `/lib/auth-config.ts`
- Add/remove admin emails anytime by editing `ADMIN_EMAILS`
- Google handles all password security and 2FA
- No need to manage passwords anymore!

---

Happy securing! 🔐✨
