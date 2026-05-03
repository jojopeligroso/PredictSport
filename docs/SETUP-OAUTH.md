# Google OAuth Setup (Supabase)

Setup guide for configuring Google sign-in for PredictSport.

## 1. Create Google Cloud OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services > OAuth consent screen**
   - Choose **External** user type
   - Fill in the app name ("PredictSport"), your email as support contact, and developer contact
   - Add scopes: `email`, `profile`, `openid`
   - Add your email as a test user (required while in "Testing" status)
   - Submit
4. Navigate to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Name: "PredictSport" (or anything descriptive)
   - Under **Authorized redirect URIs**, add:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     (Find your project ref in your Supabase dashboard URL or project settings)
   - Click **Create**
   - Copy the **Client ID** and **Client Secret**

## 2. Configure Supabase

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Authentication > Providers > Google**
   - Toggle **Enable Sign in with Google**
   - Paste the **Client ID** and **Client Secret** from step 1
   - Save
3. Go to **Authentication > URL Configuration**
   - **Site URL**: Set to your production URL (e.g. `https://your-app.vercel.app`) or `http://localhost:3000` for local dev
   - **Redirect URLs**: Add all valid callback URLs:
     ```
     http://localhost:3000/auth/callback
     https://your-app.vercel.app/auth/callback
     ```
   - Save

## 3. Environment Variables

In your `.env.local` (already defined in `.env.local.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

No Google-specific env vars are needed in the Next.js app -- the Google credentials live in the Supabase dashboard only.

## How It Works

1. User clicks "Continue with Google" (`src/components/LoginButton.tsx`)
2. `supabase.auth.signInWithOAuth({ provider: "google" })` redirects to Google
3. Google authenticates and redirects back to `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase exchanges the code for a session and redirects to `/auth/callback` in the app
5. The app route (`src/app/auth/callback/route.ts`) calls `exchangeCodeForSession` and redirects to `/`

## Troubleshooting

- **"redirect_uri_mismatch"**: The redirect URI in Google Console must exactly match `https://<project-ref>.supabase.co/auth/v1/callback`
- **Login works but redirects to login page**: Check that your Site URL and Redirect URLs in Supabase Auth settings include your current domain
- **"Access blocked: app has not completed verification"**: While the OAuth consent screen is in "Testing" status, only added test users can sign in. Publish the app to allow anyone with a Google account.
