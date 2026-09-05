/**
 * Warns when ADMIN_EMAILS in .env no longer matches the roles in the database.
 * Runs before `npm run dev` (see the `predev` script).
 *
 * Editing .env changes nothing on its own — the roles live in the database —
 * so forgetting `npm run admin:promote` leaves a removed admin with access.
 * This makes that gap visible without acting on it: starting a dev server must
 * never rewrite live permissions as a side effect.
 *
 * Guarantees: writes nothing, always exits 0, and never delays the dev server
 * by more than BUDGET_MS.
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// Sits in front of every `npm run dev`, so cap the whole check. A per-request
// timeout is not enough: DNS failures stall before a request is even sent.
const BUDGET_MS = 2500;

const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const listed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);

  // Reading roles needs the service key. Contributors running only the front
  // end will not have one, so stay quiet rather than nag them every start-up.
  if (!url || !serviceKey) return;

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(BUDGET_MS) }),
    },
  });

  const query = db.from("users").select("email").eq("role", "admin");
  const expired = new Promise(resolve => {
    setTimeout(resolve, BUDGET_MS, null).unref();
  });

  const result = await Promise.race([query, expired]);

  // Timed out, offline, or the query failed: say nothing rather than block.
  if (!result || result.error) return;

  const actual = (result.data ?? []).map(row => row.email).filter(Boolean);
  const stale = actual.filter(email => !listed.includes(email.toLowerCase()));
  const pending = listed.filter(email => !actual.some(a => a.toLowerCase() === email));

  if (!stale.length && !pending.length) return;

  const warn = line => console.log(`${YELLOW}${line}${RESET}`);

  console.log("");
  console.log(`${YELLOW}${BOLD}  ADMIN_EMAILS does not match the database.${RESET}`);
  stale.forEach(email => warn(`    still admin, not in .env:  ${email}`));
  pending.forEach(email => warn(`    in .env, not admin yet:    ${email}`));
  warn("    Apply with: npm run admin:promote");
  console.log("");
}

try {
  await main();
} catch {
  // Offline, DNS failure, bad credentials — never block the dev server.
}

process.exit(0);
