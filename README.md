# Here — MVP

**Meet the people already around you.** Dating. Business. Social. Right here, right now.

A B2B2C presence app for hotels, restaurants, bars, rooftops, beach clubs, coworkings and
events: guests scan a venue's QR code, confirm they're actually there (GPS + heartbeat +
re-verification — not just "scanned once, six hours ago"), and see who else in the room
has chosen to be visible.

---

## 1. Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth (magic link), Storage, Realtime
- Deployed as a PWA (installable on iPhone via "Add to Home Screen")

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase dashboard →
  **Project Settings → API**.
- `SUPABASE_SERVICE_ROLE_KEY` — same page, **service_role** secret. Server-only — used by
  `scripts/seed.ts` and the `/admin` aggregate queries. Never expose this in client code.
- `NEXT_PUBLIC_SITE_URL` — your deployed URL (used to build the venue QR codes in
  `/dashboard`). Update it after you deploy.
- `ADMIN_EMAILS` — comma-separated emails allowed into `/admin`. Simple allowlist for
  the MVP; see `lib/admin.ts` for how to replace it with a real roles table later.

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Sign in via the magic-link email (Supabase's local email
testing works out of the box in the dashboard's **Auth → Logs**, or use a real inbox).

## 4. Set up Supabase

1. Create a project at https://supabase.com.
2. **SQL Editor** → run `supabase/migrations/0001_init.sql` (schema, RLS, RPC functions).
3. **SQL Editor** → run `supabase/seed_venues.sql` (the four demo venues + zones).
4. **Storage** → create a public bucket named `avatars` (used for profile photos).
5. **Authentication → Providers** → confirm Email (magic link / OTP) is enabled. Under
   **Authentication → URL Configuration**, add your site URL and
   `{SITE_URL}/auth/callback` to the redirect allow-list.
6. (Optional, recommended) **Database → Extensions** → enable `pg_cron`, then in the SQL
   editor run:
   ```sql
   select cron.schedule('expire-stale-checkins', '*/2 * * * *', $$select expire_stale_checkins()$$);
   ```
   This runs the auto-checkout sweep every 2 minutes. If your plan doesn't support
   `pg_cron`, call `expire_stale_checkins()` on a schedule from a Supabase Edge Function
   or an external cron hitting a small API route instead — the query filters in
   `get_people_here()` already prevent stale check-ins from *displaying* as present even
   before the sweep runs, so this step is a safety net, not a hard dependency.
7. Populate `.env.local` with the project's URL + keys (step 2 above).
8. Seed demo people:
   ```bash
   npm run seed
   ```
   This creates ~20 fictional users (via the Supabase admin API) and checks them into
   the four demo venues with a mix of "Here now" and "Recently here" states, so you can
   see the presence system working immediately.
9. To use `/dashboard`, link your own account to a demo venue as an owner:
   ```sql
   insert into venue_admins (venue_id, user_id, role)
   values ((select id from venues where slug = 'hotel-de-russie'), 'YOUR-USER-UUID', 'owner');
   ```
   (Find your user UUID in **Authentication → Users** after signing in once.)

## 5. Deploy

### Vercel
1. Push this repo to GitHub.
2. Import it in Vercel, framework preset **Next.js** (auto-detected).
3. Add the environment variables from step 2 in **Project Settings → Environment
   Variables**.
4. Deploy. Update `NEXT_PUBLIC_SITE_URL` to the resulting URL and redeploy (or set it to
   your custom domain).

### Netlify
1. Push this repo to GitHub.
2. New site from Git, build command `npm run build`, publish directory `.next`
   (a `netlify.toml` with the `@netlify/plugin-nextjs` plugin is already included).
3. Add the same environment variables under **Site configuration → Environment
   variables**.
4. Deploy, then update `NEXT_PUBLIC_SITE_URL` the same way as above.

### Try it on your iPhone
Open the deployed URL in Safari → Share → **Add to Home Screen**. The manifest
(`public/manifest.json`) and icons (`public/icons/`) are already wired up; location
permission is requested only at the moment of "Join the room," matching iOS's
restrictions on background geolocation (the product intentionally never claims
always-on background tracking).

---

## 6. What's actually finished

- **Verified presence system**: QR-initiated GPS check-in, radius verification per
  venue, `verified_now` / `recently_verified` / `expired` / `checked_out` states,
  heartbeat, "Still here?" re-verification prompt, auto-checkout — all match section 5
  of the brief, including the confidence-score field for future multi-signal fusion.
- **Single active venue enforcement**: `check_in()` auto-checks-out any other active
  check-in for the same user before creating a new one.
- **Full social flow**: Wave → reciprocal Wave → Match → Realtime chat, with rate
  limiting on waves and a match banner ("You should meet.").
- **Privacy by design**: raw coordinates never leave the database (only distance is
  computed server-side); `visible` toggle removes a user from `get_people_here()`
  entirely; Block and Report tables + UI (from the chat menu) + RLS that makes messages
  structurally unreadable by venues (no policy grants them access, not just a UI
  omission).
- **Venue dashboard**: aggregated stats (people here now, check-ins/visitors/waves/
  matches today, connection rate), venue QR download.
- **Admin back-office**: global stats, venue create/edit/delete, pending-report
  moderation queue.
- **Landing page** and full onboarding → venue → people-here → wave → match → chat →
  profile flow, styled to the dark-luxury / editorial direction from the brief.
- **Demo data**: 4 real venue fixtures (Hotel de Russie, Soho House Paris, The Edition
  London, Scorpios Mykonos) + a seed script for ~20 fictional profiles in mixed
  presence states.
- **PWA**: manifest, install icons, mobile-first layout, Safari-safe viewport handling.
- **Production build verified**: `npm run build` compiles cleanly with zero TypeScript
  errors (see note below on fonts).

## 7. Known limitations / what's next

- **Hotel "staying vs. here now"**: the schema has a `mode` column (`here_now` /
  `staying`) reserved for multi-day hotel guests, but only `here_now` is wired into the
  UI. A real "staying" flow (e.g. tied to a PMS/booking integration) is future work.
- **Wi-Fi verification**: `verification_method` already includes `wifi` and
  `partner_api` as valid enum values and `presence_verifications.confidence_score`
  is designed for multi-signal fusion, but no partner Wi-Fi integration exists yet —
  intentionally, per the brief.
- **Billing**: `subscriptions` and `plan` exist in the schema and are shown in the
  dashboard/admin, but Stripe isn't wired up (also per the brief).
- **Admin gating** is a simple `ADMIN_EMAILS` allowlist, not a proper roles table —
  fine for a first deploy, flagged in `lib/admin.ts` for hardening later.
- **Profile editing** reuses the onboarding form (`/onboarding` now doubles as an editor
  once a profile exists) rather than a separate settings screen.
- **Multiple QR codes per zone** (lobby / bar / terrace): `venue_zones` exists in the
  schema and `check_in()` accepts an optional `zone_id`, but the QR-download UI in
  `/dashboard` only generates one QR per venue today, not one per zone.
- **Fonts at build time**: this sandbox has no outbound access to `fonts.googleapis.com`,
  so the production build here was verified with a temporary system-font fallback, then
  the real `next/font/google` (Fraunces/Inter/IBM Plex Mono) layout was restored before
  handoff. Vercel/Netlify build servers do have internet access, so this resolves itself
  on real deployment — no action needed, just flagging it so it's not a surprise in your
  first deploy log.
- **Native push notifications** (for waves/messages while the app is closed) aren't
  implemented — the PWA is installable but notifications would need a service worker +
  push subscription flow, which is a reasonable next milestone.
