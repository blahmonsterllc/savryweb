# ✅ Your Google OAuth Setup - COMPLETE!

I've extracted your credentials and added them to `.env.local`.

---

## ✅ What's Already Done

### 1. Credentials Extracted ✅
```
GOOGLE_CLIENT_ID=1021651065638-ljat8g70nbhibploo7p7ts7v233lf2ob.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### 2. Added to .env.local ✅
Your local environment is ready!

---

## 🔧 One More Step: Verify Redirect URIs

You need to make sure these redirect URIs are configured in Google Cloud Console:

### Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID: `1021651065638-ljat8g70nbhibploo7p7ts7v233lf2ob`
3. Under "Authorized redirect URIs", make sure you have:

```
Development:
http://localhost:3000/api/auth/callback/google

Production (replace with your domain):
https://your-actual-domain.com/api/auth/callback/google
```

**Example production URLs:**
- `https://savry.io/api/auth/callback/google`
- `https://savryapp.com/api/auth/callback/google`
- `https://your-vercel-url.vercel.app/api/auth/callback/google`

### If They're Not There:

1. Click "Add URI"
2. Paste the URLs above
3. Click "Save"
4. Wait 5 minutes for changes to propagate

---

## 🧪 Test Locally (Right Now!)

```bash
# Start your dev server
cd /Users/gordonlafler/Desktop/savryiowebsite
npm run dev
```

Then visit:
1. **http://localhost:3000/admin/login**
2. Click "Sign in with Google"
3. Sign in with **savryapp@gmail.com** (or your whitelisted email)
4. Should redirect to **http://localhost:3000/admin** ✅

---

## 🚀 Deploy to Vercel

Once local testing works, add to Vercel:

### Option 1: Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add these 3 variables:

```
Name: GOOGLE_CLIENT_ID
Value: 1021651065638-ljat8g70nbhibploo7p7ts7v233lf2ob.apps.googleusercontent.com
Environment: Production, Preview, Development

Name: GOOGLE_CLIENT_SECRET
Value: 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
Environment: Production, Preview, Development

Name: NEXTAUTH_URL
Value: https://your-actual-domain.com
Environment: Production
```

**Note:** You already have `NEXTAUTH_SECRET` - keep it!

### Option 2: Vercel CLI

```bash
vercel env add GOOGLE_CLIENT_ID production
# Paste: 1021651065638-ljat8g70nbhibploo7p7ts7v233lf2ob.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_SECRET production
# Paste: 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

vercel env add NEXTAUTH_URL production
# Paste: https://your-actual-domain.com
```

---

## 📋 Quick Checklist

### Local Setup ✅
- [x] ✅ Credentials extracted from JSON
- [x] ✅ Added to `.env.local`
- [ ] 🔴 Verify redirect URI in Google Console
- [ ] 🔴 Test login at http://localhost:3000/admin/login
- [ ] 🔴 Verify you can access `/admin` dashboard

### Production Setup
- [ ] 🔴 Add redirect URI for production domain in Google Console
- [ ] 🔴 Add env vars to Vercel Dashboard
- [ ] 🔴 Update `NEXTAUTH_URL` to production domain
- [ ] 🔴 Deploy to Vercel
- [ ] 🔴 Test login at https://your-domain.com/admin/login

---

## 🎯 Your Credentials Summary

**Project ID:** savry-13adf  
**Client ID:** 1021651065638-ljat8g70nbhibploo7p7ts7v233lf2ob.apps.googleusercontent.com  
**Client Secret:** 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  
**Authorized Emails:** savryapp@gmail.com (add more in `lib/auth-config.ts`)

---

## 🧪 Test It Now!

### Step 1: Start Dev Server

```bash
npm run dev
```

### Step 2: Visit Admin Login

```
http://localhost:3000/admin/login
```

### Step 3: Sign In

- Click "Sign in with Google"
- Use savryapp@gmail.com
- Should redirect to /admin dashboard ✅

### Expected Result:

```
✅ Google login page appears
✅ Sign in successful
✅ Redirects to /admin
✅ Shows dashboard with "Signed in as savryapp@gmail.com"
```

### If It Fails:

**Error: "redirect_uri_mismatch"**
→ Add `http://localhost:3000/api/auth/callback/google` to Google Console

**Error: "Access denied"**
→ Your email is not in `lib/auth-config.ts` ADMIN_EMAILS list

**Error: "NEXTAUTH_SECRET not set"**
→ Already set in .env.local, just restart dev server

---

## 🚀 Ready to Deploy?

Once local testing works:

1. ✅ Add production redirect URI to Google Console
2. ✅ Add env vars to Vercel
3. ✅ Deploy!

```bash
git add .
git commit -m "Add Google OAuth credentials"
git push origin main
```

Vercel will auto-deploy! 🎉

---

## 📞 What's Your Production Domain?

You need to know this for:
1. Google Console redirect URI
2. Vercel `NEXTAUTH_URL` env var

**Examples:**
- Custom domain: `https://savry.io`
- Vercel domain: `https://savryiowebsite.vercel.app`

Once you know it, add to Google Console:
```
https://your-domain.com/api/auth/callback/google
```

---

## ✅ Summary

**Local Environment:** ✅ READY  
**Google OAuth:** ✅ CONFIGURED  
**Admin Email:** ✅ savryapp@gmail.com whitelisted  

**Next Steps:**
1. Verify redirect URI in Google Console
2. Test local login
3. Add production redirect URI
4. Deploy to Vercel

**You're almost there!** 🎉
