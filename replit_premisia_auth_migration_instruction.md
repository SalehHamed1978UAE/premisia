I want to migrate authentication from Replit OIDC to Supabase Auth. This is on its own branch, completely separate from any other feature work. Read the files listed below before starting, then show me your implementation plan before making any changes.

**Implementation Status**: ✅ COMPLETE by Agent 5 (2026-02-09)
**Branch**: `feature/supabase-auth-migration`
**See**: `SUPABASE_MIGRATION_README.md` for setup instructions

## Files to read first (in this order)

1. `server/replitAuth.ts` — current OIDC auth setup
2. `server/routes.ts` — where auth middleware is registered and applied
3. `server/index.ts` — server startup, see how auth is initialized
4. `shared/schema.ts` — the `users` and `sessions` tables
5. `client/src/hooks/useAuth.ts` or wherever the auth hook lives
6. `client/src/lib/protected-route.tsx` — route protection logic
7. `client/src/pages/auth-page.tsx` or equivalent — login UI
8. `client/src/components/layout/` — sidebar/top-bar, likely shows user name/avatar and logout
9. `package.json` — current dependencies
10. `.env.example` or `.env.local` — current env vars related to auth

Read ALL of these before proposing anything. Understand the current auth flow end to end.

## What we are building

Replace Replit OIDC authentication with Supabase Auth. The user-facing result:
- "Sign in with Google" button (primary)
- Email + password sign up/sign in (secondary)
- Magic link option (nice to have, Supabase supports it by default)
- No mention of Replit anywhere in the auth flow

## Architecture decisions

### Supabase project setup (I will do this manually)
- I will create a Supabase project and provide these env vars:
  - `SUPABASE_URL` — project URL
  - `SUPABASE_ANON_KEY` — public anon key (safe for frontend)
  - `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never exposed to frontend
  - `SUPABASE_JWT_SECRET` — for verifying JWTs server-side

### Session strategy
- Supabase Auth uses JWTs, not server-side sessions
- The frontend Supabase client handles token refresh automatically
- The backend verifies the JWT on every request — no session table needed for auth
- KEEP the existing `sessions` table and `connect-pg-simple` for now — do not delete them. Other things may depend on the session. We will clean up later.

### User table strategy
- KEEP the existing `users` table in shared/schema.ts
- Add a new column: `supabaseUid` (text, unique, nullable) to link to the Supabase auth user ID
- On first login, check if a user with that email exists in our `users` table:
  - If yes: update their `supabaseUid` field (handles migration of any existing users)
  - If no: create a new row in `users` with data from the Supabase user object
- All existing code that references `user.id` (our internal integer/serial ID) continues to work. The `supabaseUid` is only used for the auth lookup.

### Google OAuth setup (I will do this manually)
- I will configure Google OAuth credentials in the Supabase dashboard
- I will add the redirect URLs in both Google Cloud Console and Supabase
- The code just needs to call `supabase.auth.signInWithOAuth({ provider: 'google' })`

## Backend changes

### New file: `server/supabaseAuth.ts`
Create this file to replace `server/replitAuth.ts`. It should export:

1. `initializeSupabaseAuth()` — creates and exports the Supabase server client using `SUPABASE_SERVICE_ROLE_KEY`
2. `isAuthenticated` middleware — replaces the current isAuthenticated:
   - Extract the JWT from the `Authorization: Bearer <token>` header
   - Verify it using Supabase's `auth.getUser(token)` with the service role client
   - Look up or create the user in our `users` table using the Supabase user's email and UID
   - Attach the user to `req.user` (same shape as current req.user so downstream code doesn't break)
   - If no valid token, return 401
3. `getCurrentUser(req)` helper — extracts user from request, returns our internal user object

Also support the existing `DEV_AUTH_BYPASS` env var — if true, inject a synthetic dev user just like the current system does. This keeps local development working without Supabase.

### Modify: `server/routes.ts`
- Remove Replit OIDC setup (passport, openid-client strategy registration)
- Replace with `initializeSupabaseAuth()` call
- Replace the OIDC callback route with a simple `GET /api/auth/user` endpoint that:
  - Runs `isAuthenticated` middleware
  - Returns the current user object (our internal user, not the Supabase user)
- Add `POST /api/auth/logout` endpoint (optional — frontend can handle this client-side, but good to have for clearing any server state)
- Keep `isAuthenticated` middleware on all `/api/*` routes exactly as before

### Modify: `server/index.ts`
- Remove any Replit-specific auth initialization
- Add `initializeSupabaseAuth()` to the startup sequence
- Remove passport initialization if it exists here

### Modify: `shared/schema.ts`
- Add `supabaseUid` column to the `users` table:
  ```
  supabaseUid: text('supabase_uid').unique()
  ```
- Do NOT modify any other tables or columns

### Remove or deprecate: `server/replitAuth.ts`
- Rename to `server/replitAuth.ts.deprecated` — do not delete, in case we need to reference it

## Frontend changes

### New dependency
- Install `@supabase/supabase-js`

### New file: `client/src/lib/supabase.ts`
- Create the Supabase browser client using `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- These values need to be exposed to the frontend via Vite's env system (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Export the client instance

### Modify: Auth hook (`useAuth` or equivalent)
Replace the current auth hook with one that:
- Uses Supabase's `onAuthStateChange` listener to track auth state
- When user is authenticated, calls `GET /api/auth/user` with the Supabase JWT in the Authorization header to get our internal user object
- Exposes: `user` (our internal user), `isLoading`, `isAuthenticated`, `login()`, `logout()`, `signUp()`
- `login()` options: `loginWithGoogle()` → calls `supabase.auth.signInWithOAuth({ provider: 'google' })`, `loginWithEmail(email, password)` → calls `supabase.auth.signInWithPassword()`
- `logout()` → calls `supabase.auth.signOut()`

### Modify: `client/src/lib/protected-route.tsx`
- Update to use the new auth hook
- Same behavior: redirect to login if not authenticated, show content if authenticated

### Modify: Auth page (`auth-page.tsx` or equivalent)
Replace the current Replit login button with:
- "Sign in with Google" button (prominent, primary)
- Email + password form (secondary, below)
- "Create account" toggle/link for new email users
- Use the existing Shadcn/ui components (Button, Input, Card) — match the current app's design language
- Handle auth errors (invalid credentials, email already exists, etc.)
- On successful auth, redirect to dashboard

### Modify: Layout components (sidebar/top-bar)
- Update logout button to call the new `logout()` function
- User display (name, avatar) should still work since we're keeping the same user object shape

### Modify: TanStack Query / API calls
- All existing API calls using TanStack Query need to include the Supabase JWT in the Authorization header
- The cleanest way: create a shared fetch wrapper or modify the existing queryClient's default fetch to automatically include the token:
  ```
  headers: { 'Authorization': `Bearer ${supabase.auth.session()?.access_token}` }
  ```
- Find where the queryClient or default fetch is configured (likely `client/src/lib/queryClient.ts`) and add the auth header there globally

## Environment variable changes

### Add these new env vars:
- `VITE_SUPABASE_URL` — Supabase project URL (frontend)
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (backend only)
- `SUPABASE_JWT_SECRET` — JWT verification secret (backend only)

### Keep these existing env vars:
- `DEV_AUTH_BYPASS` — still used for local dev
- `SESSION_SECRET` — keep for now, sessions table still exists
- `ENCRYPTION_KEY` — unchanged, used for data encryption

### These become unused (but do not delete from .env.example yet):
- `ISSUER_URL`
- `REPLIT_DOMAINS`
- `REPL_ID` (check if anything else uses this besides auth)

## What NOT to do

- Do NOT delete the `sessions` table or remove `connect-pg-simple` — other things may use the session
- Do NOT delete `server/replitAuth.ts` — rename to `.deprecated`
- Do NOT change any data encryption logic (ENCRYPTION_KEY, AWS KMS)
- Do NOT modify any journey, framework, EPM, or export code
- Do NOT change the `users` table structure beyond adding `supabaseUid`
- Do NOT change how `user.id` works downstream — all existing user references stay intact
- Do NOT add any new UI pages beyond modifying the existing auth page
- Do NOT set up the Supabase project or Google OAuth — I will do that manually and provide the keys

## Migration safety

- Existing users: When they first log in via Supabase (using the same email), the system finds their existing `users` row and links their `supabaseUid`. No data loss.
- New users: A new `users` row is created with `supabaseUid` populated from the start.
- Rollback: If something goes wrong, we can revert the branch. The `replitAuth.ts.deprecated` file is there for reference.

## Show me the plan first

Before writing any code, show me:
1. Every file you will create, modify, or rename — with a brief description of what changes
2. The new auth flow diagram: user clicks Google → what happens step by step → user sees dashboard
3. How you will modify the global fetch/queryClient to include the JWT
4. Any risks or questions you see in this migration

Then wait for my approval before implementing.
