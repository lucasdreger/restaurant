# Google SSO Verification Checklist

## ✅ Configuration Verification

### 1. Supabase Project Settings

**Project ID:** `uwobjrgouqtkawgcvabr`
**Project URL:** `https://uwobjrgouqtkawgcvabr.supabase.co`

#### Required Supabase Configuration:

1. **Authentication → URL Configuration**
   - [ ] Site URL: `http://localhost:5173`
   - [ ] Redirect URLs (both required):
     - [ ] `http://localhost:5173`
     - [ ] `http://localhost:5173/`

2. **Authentication → Providers → Google**
   - [ ] Google provider is **Enabled**
   - [ ] Google Client ID is configured
   - [ ] Google Client Secret is configured
   - [ ] Callback URL shows: `https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback`

### 2. Google Cloud Console Settings

**Required Google OAuth Configuration:**

1. Go to: https://console.cloud.google.com/
2. Select your project (or create one)
3. **APIs & Services → Credentials**
   - [ ] OAuth 2.0 Client ID created (Web application)
   - [ ] **Authorized redirect URIs** includes:
     ```
     https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback
     ```
   - [ ] Client ID and Secret copied to Supabase

### 3. Database Migration

- [ ] Profiles table exists with auto-creation trigger
- [ ] Migration `20260122150000_auto_create_profile.sql` has been applied
- [ ] Function `handle_new_user()` exists and is working

### 4. Local Environment

- [ ] `.env` file contains correct Supabase URL and Anon Key
- [ ] Dev server is running on `http://localhost:5173`
- [ ] Browser cache cleared for localhost:5173

---

## 🧪 Testing Steps

### Test 1: Check Supabase Connection
```bash
cd kitchen-compliance
npm run dev
```
- [ ] App loads without errors
- [ ] Landing page displays
- [ ] Browser console shows no Supabase errors

### Test 2: Google Sign-In Flow
1. [ ] Click "Sign In" button
2. [ ] Click "Continue with Google"
3. [ ] Redirects to Google login page
4. [ ] After Google authentication, redirects back to `http://localhost:5173`
5. [ ] App detects session and shows onboarding OR dashboard

### Test 3: Verify Profile Creation
After successful Google login:
1. Go to Supabase Dashboard
2. **Table Editor → profiles**
3. [ ] New row exists with your Google email
4. [ ] `id` matches your user ID from auth.users
5. [ ] `onboarding_completed` is `false` (first time) or `true` (completed)

### Test 4: Browser Console Logs
After clicking "Continue with Google", check console for:
```
🔐 OAuth Sign-in attempt: google
📡 Calling Supabase OAuth with redirect: http://localhost:5173
📥 OAuth response: {...}
✅ OAuth initiated successfully
```

After redirect back:
```
🔍 Checking authentication in background...
🔄 Auth state changed: SIGNED_IN
👤 Profile data: {...}
```

---

## 🐛 Troubleshooting Guide

### Issue: Redirects to landing page after Google login

**Possible Causes:**
1. Redirect URLs not configured in Supabase
2. Google OAuth callback URL incorrect
3. Profile creation failed

**Solutions:**
- Verify redirect URLs are EXACTLY: `http://localhost:5173` and `http://localhost:5173/`
- Check browser console for errors
- Verify profile was created in database

### Issue: "Authentication not configured" error

**Solution:**
- Check `.env` file has correct values
- Restart dev server: `npm run dev`
- Clear browser cache

### Issue: Google login button doesn't appear

**Solution:**
- Check `availableProviders` state in SignInModal
- Verify Supabase is configured (check console logs)

### Issue: Profile not created automatically

**Solution:**
1. Check if migration was applied:
```sql
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```
2. Re-run migration if needed:
```bash
# In Supabase SQL Editor
-- Run: supabase/migrations/20260122150000_auto_create_profile.sql
```

### Issue: Stuck in onboarding loop

**Solution:**
1. Complete onboarding questionnaire
2. Verify `onboarding_completed` is set to `true`
3. If still stuck, manually update:
```sql
UPDATE profiles 
SET onboarding_completed = true 
WHERE id = 'your-user-id';
```

---

## 📋 Quick Verification Commands

### Check if dev server is running:
```bash
curl http://localhost:5173
```

### Check Supabase connectivity:
```bash
curl https://uwobjrgouqtkawgcvabr.supabase.co/rest/v1/
```

### Verify environment variables:
```bash
cd kitchen-compliance
cat .env | grep SUPABASE
```

---

## ✨ Expected Flow (Happy Path)

1. **User visits app** → Landing page shows
2. **Clicks "Sign In"** → Modal opens
3. **Clicks "Continue with Google"** → Redirects to Google
4. **Completes Google login** → Redirects to `http://localhost:5173`
5. **Profile auto-created** → Onboarding questionnaire shows
6. **Completes onboarding** → Dashboard displays
7. **Future logins** → Directly to dashboard (no onboarding)

---

## 🔧 Manual Testing Script

Run this in browser console after clicking Google sign-in:

```javascript
// Check Supabase client
console.log('Supabase configured:', Boolean(window.location.origin))

// Check current session
const checkSession = async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    'https://uwobjrgouqtkawgcvabr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3b2JqcmdvdXF0a2F3Z2N2YWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MTc1NjEsImV4cCI6MjA4NDE5MzU2MX0.zpqMrZXNy_Z2zO-_Cwu0bQX-o6g-ow3dhJXXz6lfTW8'
  )
  
  const { data: { session } } = await supabase.auth.getSession()
  console.log('Current session:', session)
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    console.log('Profile:', profile)
  }
}

checkSession()
```

---

## 🎯 Success Criteria

All of these should be ✅:
- [ ] Google sign-in redirects to Google login
- [ ] After Google auth, redirects back to app
- [ ] Profile auto-created in database
- [ ] Onboarding shows for new users
- [ ] Dashboard shows for existing users
- [ ] No errors in browser console
- [ ] Session persists after page reload

---

## 📞 Support Resources

- **Supabase Dashboard:** https://app.supabase.com/project/uwobjrgouqtkawgcvabr
- **Google Cloud Console:** https://console.cloud.google.com/
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth/social-login/auth-google
- **Project Setup Guide:** `GOOGLE_SSO_SETUP.md`
