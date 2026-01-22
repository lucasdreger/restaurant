# GitHub Pages Deployment Guide

This guide explains how to deploy Kitchen Compliance to GitHub Pages with working authentication (Email + Google SSO).

## Production URL
```
https://lucasdreger.github.io/restaurant/
```

---

## Step 1: Add GitHub Repository Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these two secrets:

| Secret Name | Value |
|-------------|-------|
| `VITE_SUPABASE_URL` | `https://uwobjrgouqtkawgcvabr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(Your Supabase anon/public key)* |

> **Finding your Supabase Anon Key:**  
> Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → **Settings** → **API** → Copy the `anon public` key

---

## Step 2: Configure Supabase Redirect URLs

Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → **Authentication** → **URL Configuration**

### Site URL
Set the Site URL to your GitHub Pages URL:
```
https://lucasdreger.github.io/restaurant/
```

### Redirect URLs
Add these URLs to the **Redirect URLs** list:

```
https://lucasdreger.github.io/restaurant/
https://lucasdreger.github.io/restaurant
http://localhost:5173
http://localhost:5173/
```

> **Important:** Both with and without trailing slash are needed because browsers handle this differently.

---

## Step 3: Configure Google OAuth Redirect URIs

Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → Your OAuth 2.0 Client ID

### Authorized JavaScript Origins
Add:
```
https://lucasdreger.github.io
```

### Authorized Redirect URIs
Add the Supabase callback URL:
```
https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback
```

> **Note:** The Google OAuth redirect goes to Supabase first, then Supabase redirects to your app. This is why you only need the Supabase callback URL here.

---

## Step 4: Enable GitHub Pages

Go to your GitHub repository → **Settings** → **Pages**

1. Under **Source**, select **GitHub Actions**
2. The workflow will automatically deploy when you push to `main`

---

## Step 5: Deploy

Push your changes to the `main` branch:

```bash
cd kitchen-compliance
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

The GitHub Action will:
1. Install dependencies
2. Build the app with your Supabase credentials
3. Deploy to GitHub Pages

Check the deployment status at:
- **Actions tab**: `https://github.com/lucasdreger/restaurant/actions`
- **Live site**: `https://lucasdreger.github.io/restaurant/`

---

## Troubleshooting

### Authentication not working after redirect

**Problem:** User signs in but gets redirected back to login page.

**Solution:** Make sure both URLs (with and without trailing slash) are in Supabase Redirect URLs:
- `https://lucasdreger.github.io/restaurant/`
- `https://lucasdreger.github.io/restaurant`

### Google Sign-In popup closes without logging in

**Problem:** Google OAuth popup opens but closes without completing.

**Solutions:**
1. Check that `https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback` is in Google's Authorized Redirect URIs
2. Verify `https://lucasdreger.github.io` is in Authorized JavaScript Origins
3. Make sure the OAuth Consent Screen is configured and published

### 404 errors on page refresh

**Problem:** Direct URLs like `https://lucasdreger.github.io/restaurant/dashboard` return 404.

**Solution:** This is a known SPA issue with GitHub Pages. The app uses hash routing or needs a custom 404.html. Current setup uses React Router which handles this client-side.

### Build fails in GitHub Actions

**Problem:** The deployment workflow fails.

**Solutions:**
1. Check that both secrets are added correctly (no extra spaces)
2. Verify the workflow file is at `.github/workflows/deploy.yml`
3. Check the Actions tab for detailed error logs

---

## Quick Reference

| Service | URL/Setting |
|---------|-------------|
| **Live App** | https://lucasdreger.github.io/restaurant/ |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/uwobjrgouqtkawgcvabr |
| **Supabase Auth Callback** | https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback |
| **Google Cloud Console** | https://console.cloud.google.com/apis/credentials |
| **GitHub Actions** | https://github.com/lucasdreger/restaurant/actions |

---

## OAuth Flow Diagram

```
User clicks "Sign in with Google"
         ↓
App redirects to Google OAuth
         ↓
User authenticates with Google
         ↓
Google redirects to Supabase callback:
  https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback
         ↓
Supabase validates and redirects to your app:
  https://lucasdreger.github.io/restaurant/
         ↓
App detects session in URL (detectSessionInUrl: true)
         ↓
User is logged in!
