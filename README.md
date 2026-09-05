# Exam Portal

A student exam portal built on [Vite](https://vite.dev) and [Supabase](https://supabase.com).
Students sign in, take tests linked from Google Forms, and review their scores;
admins create tests and monitor results.

## Getting started

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
cp .env.example .env   # then fill in your Supabase values
npm run dev
```

The dev server runs at <http://localhost:5173>.

## Scripts

| Script                  | What it does                                         |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start the dev server with hot reloading              |
| `npm run build`         | Build the production bundle into `dist/`             |
| `npm run preview`       | Serve the built `dist/` locally                      |
| `npm run admin:promote` | Sync admin roles in the database from `ADMIN_EMAILS` |
| `npm run lint`          | Lint with ESLint                                     |
| `npm run lint:fix`      | Lint and auto-fix                                    |
| `npm run format`        | Format with Prettier                                 |
| `npm run format:check`  | Check formatting without writing                     |
| `npm run check`         | Lint + format check + build (use this before a PR)   |

## Configuration

Configuration lives in `.env`, which is git-ignored. Copy `.env.example` and
fill it in.

**The `VITE_` prefix is a security boundary.** Vite inlines every `VITE_*`
variable into the JavaScript bundle, so anything carrying that prefix is public
and readable in DevTools. Variables without it never leave your machine.

| Variable                    | Prefix  | Reaches the browser? | Used by                 |
| --------------------------- | ------- | -------------------- | ----------------------- |
| `VITE_SUPABASE_URL`         | `VITE_` | Yes — public         | The app                 |
| `VITE_SUPABASE_ANON_KEY`    | `VITE_` | Yes — public         | The app                 |
| `SUPABASE_SERVICE_ROLE_KEY` | none    | No                   | `npm run admin:promote` |
| `ADMIN_EMAILS`              | none    | No                   | `npm run admin:promote` |

The anon key is designed to be public, but it is only _safe_ once Row Level
Security is switched on — see below. The service role key bypasses RLS
entirely; treat it like a root password.

`npm run build` refuses to run if a variable like `VITE_..._SERVICE_ROLE_KEY`
exists, so a mis-prefixed secret fails the build instead of shipping.

Vite reads `.env` at startup, so restart the dev server after changing it.

## Project structure

```
index.html          Login             (entry: src/pages/login.js)
signup.html         Registration      (entry: src/pages/signup.js)
dashboard.html      Student dashboard (entry: src/pages/dashboard.js)
profile.html        Profile settings  (entry: src/pages/profile.js)
admin.html          Admin panel       (entry: src/pages/admin.js)

src/lib/supabase.js   Configured Supabase client + avatar upload
src/lib/session.js    Auth guards (requireUser / requireAdmin), sign-out
src/lib/ui.js         DOM builder, toasts, busy buttons, list rendering
src/lib/snow.js       Decorative canvas snowfall
src/styles/style.css  Single stylesheet for every page
public/               Copied to the build root as-is (favicon)

supabase/migrations/  SQL that enforces roles and row-level security
scripts/              Maintenance scripts run with npm (never bundled)
```

Each HTML file is a separate Vite entry point, so a page only downloads the
JavaScript it actually uses. Shared code is split into a common chunk
automatically, and third-party code into `vendor`.

## Database

Three tables are expected:

| Table     | Columns used by the app                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `users`   | `email`, `role` (`student` \| `admin`)                                          |
| `tests`   | `id`, `title`, `subject`, `form_url`, `created_at`                              |
| `results` | `test_id` → `tests.id`, `email`, `score`, `total`, `percentage`, `attempted_at` |

A `avatars` storage bucket holds profile pictures.

### Security setup (required)

Roles and permissions are enforced by the database, not the browser. Two steps,
both one-time:

**1. Apply the migration.** Open `supabase/migrations/0001_harden_security.sql`,
paste it into the Supabase SQL Editor and run it (or `supabase db push`). It is
idempotent. This:

- adds an `on_auth_user_created` trigger that writes each new user's role row
  as `student`, so the browser never chooses its own role;
- revokes `insert`/`update`/`delete` on `users` from the public roles;
- enables RLS on `users`, `tests` and `results` — students read only their own
  results, only admins write tests;
- restricts avatar uploads to a folder named after the uploader's own user id.

**2. Name your admins.** Put them in `.env` and apply:

```bash
ADMIN_EMAILS=you@example.com,colleague@example.com
npm run admin:promote
```

**Editing `.env` alone does nothing.** The browser never reads `ADMIN_EMAILS`;
it is an input to the script above, which writes the roles into the database.
The database is what the app checks. So every change to that line needs
`npm run admin:promote` to take effect — preview it with `--dry-run` first:

```bash
npm run admin:promote -- --dry-run
```

`ADMIN_EMAILS` is authoritative in both directions:

- an address you **add** is granted the admin role;
- an address you **remove** is demoted back to `student` on the next run.

So revoking access is just deleting the address and re-running the sync. The
script only promotes addresses that have already signed up, and reports only
what actually changes:

```
unchanged      you@example.com
would demote   ex-admin@example.com — not listed in ADMIN_EMAILS
```

`npm run dev` checks for drift on start-up and warns if `.env` and the database
disagree, so a forgotten sync is hard to miss:

```
  ADMIN_EMAILS does not match the database.
    still admin, not in .env:  ex-admin@example.com
    Apply with: npm run admin:promote
```

It only warns — it never writes. Starting a dev server should not silently
change who has access to live data, and a stale `.env` on an old branch would
otherwise demote a real admin without anyone noticing.

Emptying `ADMIN_EMAILS` means "revoke every admin", but that is also what a
`.env` that failed to load looks like — so it needs to be explicit:

```bash
npm run admin:promote -- --allow-empty
```

Revocation takes effect immediately at the database level: the RLS policies
call `is_admin()` on every query, so a demoted user's writes are refused even
if their browser session is still open. They are redirected off `admin.html`
on their next page load.

If something looks wrong, `npm run db:doctor` writes nothing and reports which
steps have actually landed:

```
Environment (.env)
  ok    SUPABASE_SERVICE_ROLE_KEY carries role "service_role"
  ok    ADMIN_EMAILS -> you@example.com
Database
  ok    migration applied — public.is_admin() exists
  warn  in ADMIN_EMAILS but not admin yet: you@example.com
Next step
  npm run admin:promote
```

Why this variable has no `VITE_` prefix: an admin list shipped to the browser
would be readable by everyone and — more importantly — a client-side check is
not a permission. `requireAdmin()` in `src/lib/session.js` only decides what UI
to render; the RLS policies are what actually stop a non-admin from writing.
Both need to be in place.

## Deploying

`npm run build` produces a fully static `dist/`, deployable to Netlify, Vercel,
GitHub Pages, or any static host. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in the host's build environment — `.env` is not
committed.
