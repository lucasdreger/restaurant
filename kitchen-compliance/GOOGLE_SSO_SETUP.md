# Google SSO Setup Guide

## Problem
When clicking Google SSO, it redirects back to the landing page instead of completing authentication.

## Root Cause
Supabase needs the exact redirect URLs configured in the Auth settings.

## Solution - Step by Step

### 1. Configure Redirect URLs in Supabase

1. Go to your Supabase project: https://uwobjrgouqtkawgcvabr.supabase.co
2. Navigate to: **Authentication** → **URL Configuration**
3. Add these EXACT URLs to **Redirect URLs**:
   ```
   http://localhost:5173
   http://localhost:5173/
   ```
   ⚠️ **Important**: Add BOTH (with and without trailing slash)

4. Save the settings

### 2. Enable Google Provider

1. Still in **Authentication** section
2. Go to **Providers** tab
3. Find **Google** and click to enable
4. You'll need:
   - Google Client ID
   - Google Client Secret

### 3. Get Google OAuth Credentials

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Choose **Web application**
7. Add these **Authorized redirect URIs**:
   ```
   https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback
   ```
8. Copy the **Client ID** and **Client Secret**

### 4. Configure in Supabase

1. Back in Supabase **Authentication** → **Providers** → **Google**
2. Paste the Client ID and Client Secret
3. Enable the provider
4. Save

### 5. Test the Flow

1. Clear browser cache and cookies for localhost:5173
2. Go to http://localhost:5173
3. Click "Sign In" → "Continue with Google"
4. Should redirect to Google login
5. After login, should redirect back to http://localhost:5173
6. App will detect session and show onboarding or dashboard

### 6. Check if Profile is Created

After successful Google login, check in Supabase:

1. Go to **Table Editor**
2. Open **profiles** table
3. You should see a new row with your Google account email
4. `onboarding_completed` should be `false` (first time)

## Current Configuration

- **Supabase URL**: `https://uwobjrgouqtkawgcvabr.supabase.co`
- **Local Dev**: `http://localhost:5173`
- **Redirect URL in Code**: `${window.location.origin}` (= `http://localhost:5173`)

## Troubleshooting

### If still redirects to landing page:

1. Open browser console (F12)
2. Look for these logs:
   ```
   🔍 Checking authentication in background...
   🔄 Auth state changed: SIGNED_IN
   👤 Profile data: ...
   ```

3. If you see "No active session", the Google redirect didn't work
   - Check Supabase redirect URLs are EXACTLY: `http://localhost:5173`
   - Check Google OAuth callback URL is: `https://uwobjrgouqtkawgcvabr.supabase.co/auth/v1/callback`

### If profile table error:

- Make sure you ran the `profiles-migration.sql` in Supabase SQL Editor
- Check that profiles table exists with `onboarding_completed` column

### If stuck in onboarding loop:

- Check if profile was created in database
- Verify `onboarding_completed` gets set to `true` after completing onboarding

## Next Steps After SSO Works

1. Complete onboarding questionnaire
2. Create first restaurant/venue
3. Start using the app!
