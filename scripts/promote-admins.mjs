/**
 * Grants the admin role to every address in ADMIN_EMAILS.
 *
 *   npm run admin:promote
 *   npm run admin:promote -- --dry-run     (report changes, write nothing)
 *   npm run admin:promote -- --allow-empty  (ADMIN_EMAILS empty = revoke all)
 *
 * The list is authoritative in both directions: an address you add is granted
 * the admin role, and an address you remove is demoted back to student.
 *
 * Roles live in the database because that is the only place they can be
 * enforced. This script is the bridge: it reads your local .env and writes the
 * result into Supabase using the service role key, which bypasses RLS.
 *
 * Nothing here reaches the browser — the variables it reads have no VITE_
 * prefix, so Vite never inlines them into the bundle.
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(entry => entry.trim().toLowerCase())
  .filter(Boolean);

const dryRun = process.argv.includes("--dry-run");
const allowEmpty = process.argv.includes("--allow-empty");

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!url) fail("Set VITE_SUPABASE_URL in .env");
if (!serviceKey) {
  fail(
    "Set SUPABASE_SERVICE_ROLE_KEY in .env\n" +
      "  Dashboard -> Project Settings -> API -> service_role.\n" +
      "  Do not add a VITE_ prefix: that would publish it to every visitor."
  );
}
// An empty list is a valid instruction ("revoke every admin"), but it is also
// what a .env that failed to load looks like. Require an explicit flag so a
// missing file cannot silently strip everyone's access.
if (!emails.length && !allowEmpty) {
  fail(
    "ADMIN_EMAILS is empty.\n\n" +
      "  To revoke every admin, say so explicitly:\n" +
      "      npm run admin:promote -- --allow-empty\n\n" +
      "  Otherwise set ADMIN_EMAILS in .env (comma-separated)."
  );
}

if (serviceKey === process.env.VITE_SUPABASE_ANON_KEY) {
  fail("SUPABASE_SERVICE_ROLE_KEY is the anon key. The anon key cannot grant roles.");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Only promote addresses that own a real account, so a typo in .env surfaces
// here instead of silently creating an orphan admin row.
const { data: accounts, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) fail(`Could not list accounts: ${listError.message}`);

const registered = new Set(accounts.users.map(user => user.email?.toLowerCase()).filter(Boolean));

const known = emails.filter(email => registered.has(email));
const unknown = emails.filter(email => !registered.has(email));

for (const email of unknown) {
  console.warn(`  skipped  ${email} — no account with that address has signed up yet`);
}

// Read the current admins BEFORE writing, so the run can report only real
// changes instead of relisting people who are already admins.
const { data: current, error: readError } = await admin
  .from("users")
  .select("email")
  .eq("role", "admin");

if (readError) fail(`Could not read current admins: ${readError.message}`);

const currentAdmins = (current ?? []).map(row => row.email).filter(Boolean);
const isAlreadyAdmin = email => currentAdmins.some(a => a.toLowerCase() === email);

// Grant to everyone listed who is not an admin yet.
const toPromote = known.filter(email => !isAlreadyAdmin(email));

// Revoke from every admin the list no longer names. This is what makes the
// removal of a line in .env actually take away access.
const stale = currentAdmins.filter(email => !emails.includes(email.toLowerCase()));

known.filter(isAlreadyAdmin).forEach(email => console.log(`  unchanged      ${email}`));

if (toPromote.length && dryRun) {
  toPromote.forEach(email => console.log(`  would promote  ${email}`));
} else if (toPromote.length) {
  const { error } = await admin.from("users").upsert(
    toPromote.map(email => ({ email, role: "admin" })),
    { onConflict: "email" }
  );

  // Without the migration there is no unique index on email, so the upsert has
  // nothing to match on. Say that plainly instead of leaking a Postgres code.
  if (error && (error.code === "42P10" || /on conflict/i.test(error.message))) {
    fail(
      "public.users has no unique constraint on `email`, so roles cannot be\n" +
        "  written safely. The migration has not been applied yet.\n\n" +
        "  Run supabase/migrations/0001_harden_security.sql in the Supabase SQL\n" +
        "  Editor, then try again. To see what landed: npm run db:doctor"
    );
  }
  if (error) fail(`Could not promote: ${error.message}`);
  toPromote.forEach(email => console.log(`  promoted       ${email}`));
}

if (stale.length && dryRun) {
  stale.forEach(email => console.log(`  would demote   ${email} — not listed in ADMIN_EMAILS`));
} else if (stale.length) {
  const { error } = await admin.from("users").update({ role: "student" }).in("email", stale);
  if (error) fail(`Could not demote: ${error.message}`);
  stale.forEach(email => console.log(`  demoted        ${email} — not listed in ADMIN_EMAILS`));
}

if (!toPromote.length && !stale.length) {
  console.log("  nothing to change — the database already matches ADMIN_EMAILS");
}

console.log(
  dryRun
    ? "\n  Dry run — nothing was written. Re-run without --dry-run to apply.\n"
    : `\n  Done. ${known.length} admin(s) in sync with ADMIN_EMAILS.\n`
);
