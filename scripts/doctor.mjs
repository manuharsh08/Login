/**
 * Read-only health check: npm run db:doctor
 *
 * Writes nothing. Reports which setup steps have actually landed and what to do
 * next, so a silent failure in .env or in the migration becomes visible.
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env")) process.loadEnvFile(".env");

const GREEN = "[32m";
const RED = "[31m";
const YELLOW = "[33m";
const RESET = "[0m";

const ok = msg => console.log(`  ${GREEN}ok${RESET}    ${msg}`);
const bad = msg => console.log(`  ${RED}FAIL${RESET}  ${msg}`);
const warn = msg => console.log(`  ${YELLOW}warn${RESET}  ${msg}`);
const hint = msg => console.log(`        ${msg}`);

function jwtRole(token) {
  try {
    const body = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(body, "base64").toString()).role;
  } catch {
    return null;
  }
}

console.log("\nEnvironment (.env)");

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const listed = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(entry => entry.trim().toLowerCase())
  .filter(Boolean);

if (!existsSync(".env")) bad("no .env file — copy .env.example to .env");

url ? ok(`VITE_SUPABASE_URL = ${url}`) : bad("VITE_SUPABASE_URL is missing");

if (!anon) {
  bad("VITE_SUPABASE_ANON_KEY is missing");
} else if (jwtRole(anon) !== "anon") {
  warn(`VITE_SUPABASE_ANON_KEY carries role "${jwtRole(anon)}" — expected "anon"`);
} else {
  ok('VITE_SUPABASE_ANON_KEY carries role "anon"');
}

if (!serviceKey) {
  bad("SUPABASE_SERVICE_ROLE_KEY is missing (needed only by admin:promote)");
} else if (jwtRole(serviceKey) !== "service_role") {
  bad(`SUPABASE_SERVICE_ROLE_KEY carries role "${jwtRole(serviceKey)}" — expected "service_role"`);
} else {
  ok('SUPABASE_SERVICE_ROLE_KEY carries role "service_role"');
}

listed.length ? ok(`ADMIN_EMAILS -> ${listed.join(", ")}`) : warn("ADMIN_EMAILS is empty");

if (!url || !serviceKey || jwtRole(serviceKey) !== "service_role") {
  console.log("\nFix the above before the database can be checked.\n");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log("\nDatabase");

// public.is_admin() only exists once the migration has run, so calling it is a
// reliable probe for whether the migration actually landed.
let migrated = false;
const { error: rpcError } = await db.rpc("is_admin");

if (rpcError && /could not find the function|does not exist|PGRST202/i.test(rpcError.message)) {
  bad("migration NOT applied — public.is_admin() does not exist");
} else if (rpcError) {
  warn(`is_admin() responded: ${rpcError.message}`);
  migrated = true;
} else {
  ok("migration applied — public.is_admin() exists");
  migrated = true;
}

const { data: rows, error: usersError } = await db.from("users").select("email, role");

if (usersError) {
  bad(`cannot read public.users: ${usersError.message}`);
} else {
  ok(`public.users has ${rows.length} row(s)`);

  const counts = new Map();
  rows.forEach(row => {
    const key = row.email?.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const duplicates = [...counts].filter(([, count]) => count > 1);
  if (duplicates.length) {
    bad(`duplicate email rows: ${duplicates.map(([e, n]) => `${e} x${n}`).join(", ")}`);
    hint("the unique index cannot be created until these are collapsed.");
    hint("the migration now does that for you — re-run it.");
  } else {
    ok("no duplicate emails");
  }

  const admins = rows.filter(row => row.role === "admin").map(row => row.email);
  admins.length ? ok(`admins in database: ${admins.join(", ")}`) : warn("no admins in database");

  const pending = listed.filter(email => !admins.some(a => a.toLowerCase() === email));
  if (pending.length) warn(`in ADMIN_EMAILS but not admin yet: ${pending.join(", ")}`);
}

const { data: accounts, error: authError } = await db.auth.admin.listUsers({ perPage: 1000 });

if (authError) {
  bad(`cannot list auth accounts: ${authError.message}`);
} else {
  ok(`${accounts.users.length} auth account(s)`);

  const signedUp = accounts.users.map(user => user.email?.toLowerCase()).filter(Boolean);
  const missing = listed.filter(email => !signedUp.includes(email));

  if (missing.length) {
    bad(`ADMIN_EMAILS entries with no account: ${missing.join(", ")}`);
    hint("sign up on /signup.html first — promote only touches real accounts.");
  }
}

console.log("\nNext step");
if (!migrated) {
  hint("Run supabase/migrations/0001_harden_security.sql in the Supabase SQL Editor.");
} else if (listed.length) {
  hint("npm run admin:promote");
} else {
  hint("Set ADMIN_EMAILS in .env, then run: npm run admin:promote");
}
console.log("");
