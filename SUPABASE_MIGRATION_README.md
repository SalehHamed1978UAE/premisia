# Supabase Authentication Migration Setup Guide

## Overview
This branch (`feature/supabase-auth-migration`) contains the complete migration from Replit OIDC to Supabase Auth.

## Setup Instructions

### 1. Prerequisites
- Supabase project created at [app.supabase.com](https://app.supabase.com)
- Google Cloud Console project with OAuth 2.0 credentials
- PostgreSQL database (existing Premisia database)

### 2. Supabase Configuration

#### Get Your Supabase Credentials:
1. Go to your Supabase project dashboard
2. Navigate to **Settings > API**
3. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with: `eyJhbGc...`)
   - **Service Role Key** (starts with: `eyJhbGc...`) - Keep this secret!
   - **JWT Secret** (under Settings > API > JWT Settings)

#### Configure Google OAuth:
1. In Supabase dashboard, go to **Authentication > Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)
4. Copy the callback URL shown (e.g., `https://xxxxx.supabase.co/auth/v1/callback`)

#### Google Cloud Console Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create a new one
3. Go to **APIs & Services > Credentials**
4. Create OAuth 2.0 Client ID (or use existing)
5. Add Authorized redirect URIs:
   - Your Supabase callback URL from above
   - `http://localhost:5173/` (for local development)
   - Your production URL

#### Email Settings (Optional but Recommended):
1. In Supabase dashboard, go to **Authentication > Email Templates**
2. Customize the confirmation email template
3. Configure SMTP settings if you want custom email sending

### 3. Environment Setup

#### Create `.env.local` file:
```bash
cp .env.local.template .env.local
```

#### Edit `.env.local` and add your values:
```env
# Database (your existing connection)
DATABASE_URL=postgresql://user:password@host/database

# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Session Management
SESSION_SECRET=generate-random-32-character-string

# Data Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Keep your existing AI keys...
ANTHROPIC_API_KEY=your-key
# ... etc
```

### 4. Database Migration

Run the migration to add the `supabaseUid` column:

```bash
# Using Drizzle
npm run db:push

# Or manually run the SQL:
psql $DATABASE_URL < migrations/add_supabase_uid.sql
```

### 5. Verify Setup

Run the verification script:
```bash
node scripts/verify-supabase-setup.js
```

This will check:
- ✅ Environment variables are set
- ✅ Supabase connection works
- ✅ Service role key is valid
- ✅ Database is ready

### 6. Start Development Server

```bash
npm run dev
```

Navigate to: http://localhost:5173

### 7. Test Authentication Flows

#### Google Sign-In:
1. Click "Sign in with Google" on auth page
2. Complete Google OAuth flow
3. Should redirect to dashboard

#### Email/Password Sign-Up:
1. Switch to "Create Account" tab
2. Enter email and password (min 6 chars)
3. Check email for verification link
4. Click link to verify
5. Sign in with credentials

#### Email/Password Sign-In:
1. Use "Sign In" tab
2. Enter existing credentials
3. Should redirect to dashboard

#### Magic Link:
1. Click "Email me a login link instead"
2. Enter email address
3. Check email for magic link
4. Click link to sign in

#### Logout:
1. Click logout button in sidebar
2. Should redirect to auth page

## Migration Notes

### Existing Users
- Users with existing accounts will be automatically linked when they sign in with the same email
- Their `supabaseUid` will be populated on first Supabase login
- All data and relationships are preserved

### New Users
- Created fresh in both Supabase and our database
- Email verification required for email/password signups
- Google OAuth users skip email verification

### Security
- All API requests now use JWT authentication
- Tokens are automatically refreshed by Supabase client
- Service role key is only used server-side
- DEV_AUTH_BYPASS still works for local development

## Troubleshooting

### "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
- Ensure `.env.local` file exists and has all required variables
- Restart the dev server after adding environment variables

### "401 Unauthorized" errors
- Check that Supabase credentials are correct
- Verify the service role key has proper permissions
- Ensure the JWT secret matches your Supabase project

### Google Sign-In not working
- Verify Google OAuth is enabled in Supabase
- Check redirect URIs in Google Cloud Console
- Ensure client ID and secret are correctly configured

### Database migration fails
- Check DATABASE_URL is correct
- Ensure database user has ALTER TABLE permissions
- Manually run the SQL if needed

### Email verification not working
- Check spam folder
- Verify email templates in Supabase dashboard
- Consider configuring custom SMTP for better delivery

## Production Deployment

1. Set all environment variables in production
2. Run database migration
3. Update Google OAuth redirect URIs
4. Configure Supabase allowed URLs
5. Test all auth flows in production

## Rollback Plan

If needed, you can rollback to Replit auth:
1. Switch back to `main` branch
2. Restore Replit environment variables
3. The `supabaseUid` column can remain (won't affect old auth)

## Support

For issues specific to this migration:
1. Check this README first
2. Run the verification script
3. Review error messages in browser console and server logs

## Files Changed

### Backend:
- `server/supabaseAuth.ts` - New auth middleware
- `server/routes.ts` - Updated to use Supabase
- `server/storage.ts` - Added Supabase user methods
- `shared/schema.ts` - Added supabaseUid column
- `server/replitAuth.ts.deprecated` - Old auth (preserved)

### Frontend:
- `client/src/lib/supabase.ts` - Supabase client
- `client/src/hooks/use-auth.tsx` - New auth hook
- `client/src/pages/auth-page.tsx` - Redesigned auth UI
- `client/src/lib/queryClient.ts` - JWT injection
- `client/src/components/layout/sidebar.tsx` - Updated logout

### Configuration:
- `.env.example` - Environment template
- `package.json` - Added @supabase/supabase-js
- `migrations/add_supabase_uid.sql` - Database migration