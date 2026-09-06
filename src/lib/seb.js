/**
 * Safe Exam Browser integration.
 *
 * Three jobs:
 *   1. Tell whether the page is being viewed inside SEB.
 *   2. Build the seb:// launch link that starts SEB with a given config.
 *   3. Generate the .seb configuration file itself.
 *
 * Read this before trusting any of it: detection here is client-side, based on
 * the user agent, which a student can spoof in thirty seconds. It is a
 * usability feature — it stops honest students opening the exam in the wrong
 * browser. Real enforcement requires the exam server to verify the
 * X-SafeExamBrowser-RequestHash header, which a Google Form cannot do.
 * See README "Enforcing SEB".
 */

/** Where a built-in test is taken. */
export function examPageUrl(testId) {
  return new URL(`exam.html?test=${encodeURIComponent(testId)}`, window.location.href).href;
}

/** Storage bucket holding generated .seb files (see migration 0006). */
export const SEB_BUCKET = "seb-configs";

/** SEB identifies itself in the user agent on every platform. */
export function isRunningInSeb() {
  const ua = navigator.userAgent ?? "";
  return /\bSEB[\s/]/i.test(ua) || /SafeExamBrowser/i.test(ua);
}

/**
 * Converts the address of a hosted .seb file into a launch link.
 * SEB registers two schemes: seb:// for http and sebs:// for https.
 */
export function sebLaunchUrl(configUrl) {
  const url = (configUrl ?? "").trim();
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === "https:")
    return `sebs://${parsed.host}${parsed.pathname}${parsed.search}`;
  if (parsed.protocol === "http:") return `seb://${parsed.host}${parsed.pathname}${parsed.search}`;

  // Already a seb:// link, or something we should not launch.
  return /^sebs?:$/.test(parsed.protocol) ? url : null;
}

const escapeXml = value =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** SEB stores the quit password as an uppercase hex SHA-256 hash. */
export async function hashQuitPassword(password) {
  const bytes = new TextEncoder().encode(password ?? "");
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function filterRule(expression) {
  return `      <dict>
        <key>action</key><integer>1</integer>
        <key>active</key><true/>
        <key>expression</key><string>${escapeXml(expression)}</string>
        <key>regex</key><false/>
      </dict>`;
}

/**
 * Builds an unencrypted .seb configuration file (an XML property list).
 *
 * Unencrypted is deliberate: it can be inspected and diffed, and SEB opens it
 * fine. Add a settings password in SEB Config Tool if you need it sealed.
 *
 * @param {object} options
 * @param {string} options.startUrl        Page SEB opens (the exam itself).
 * @param {string[]} options.allowedUrls   Expressions students may reach.
 * @param {string} [options.hashedQuitPassword] From hashQuitPassword().
 * @param {boolean} [options.allowReload]
 */
export function buildSebConfig({
  startUrl,
  allowedUrls = [],
  hashedQuitPassword = "",
  allowReload = false,
}) {
  if (!startUrl) throw new Error("A .seb config needs a start URL.");

  // The start URL must itself be reachable, so it is always whitelisted.
  const expressions = [...new Set([`${startUrl}*`, ...allowedUrls])];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>originatorVersion</key><string>Exam Portal</string>
  <key>startURL</key><string>${escapeXml(startUrl)}</string>

  <!-- Send the Browser Exam Key so the exam server can verify this config. -->
  <key>sendBrowserExamKey</key><true/>

  <!-- Quitting -->
  <key>allowQuit</key><true/>
  <key>hashedQuitPassword</key><string>${escapeXml(hashedQuitPassword)}</string>

  <!-- Navigation -->
  <key>allowBrowsingBackForward</key><false/>
  <key>browserWindowAllowReload</key>${allowReload ? "<true/>" : "<false/>"}
  <key>allowReconfiguration</key><false/>
  <key>newBrowserWindowByLinkPolicy</key><integer>0</integer>
  <key>enableJavaScript</key><true/>

  <!-- Lock the session down -->
  <key>allowPreferencesWindow</key><false/>
  <key>allowSpellCheck</key><false/>
  <key>allowDictionaryLookup</key><false/>
  <key>allowScreenSharing</key><false/>
  <key>enablePrivateClipboard</key><true/>
  <key>examSessionClearCookiesOnStart</key><true/>
  <key>allowVirtualMachine</key><false/>

  <!-- Only these addresses may load -->
  <key>URLFilterEnable</key><true/>
  <key>URLFilterEnableContentFilter</key><true/>
  <key>blacklistURLFilter</key><string></string>
  <key>URLFilterRules</key>
  <array>
${expressions.map(filterRule).join("\n")}
  </array>
</dict>
</plist>
`;
}

/** Filename for a test's config, safe on every OS. */
export function sebConfigFilename(title) {
  const slug = String(title ?? "exam")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${slug || "exam"}.seb`;
}

/**
 * Generates a test's .seb config, uploads it, and returns its public URL.
 *
 * Teachers should never touch a config file: this runs automatically when a
 * test is created or its link changes.
 *
 * @param {object} supabase Client with admin rights for the current user.
 * @param {{id: string, title: string, form_url: string}} test
 * @returns {Promise<string>} Public URL of the stored config.
 */
export async function publishSebConfig(supabase, test) {
  // The exam is served by this portal now, which is what makes the Browser
  // Exam Key verifiable — a Google Form could never check it.
  const examUrl = examPageUrl(test.id);

  // The API host must be whitelisted too. Without it SEB blocks every auth and
  // data request, so the exam page cannot see the student's session, bounces
  // them to the login page, and the login itself then fails as well.
  const apiOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

  const xml = buildSebConfig({
    startUrl: examUrl,
    allowedUrls: [`${window.location.origin}/*`, `${apiOrigin}/*`],
  });

  const path = `${test.id}.seb`;
  const file = new Blob([xml], { type: "application/octet-stream" });

  const { error } = await supabase.storage.from(SEB_BUCKET).upload(path, file, {
    contentType: "application/octet-stream",
    // No caching: a refreshed config must take effect immediately, or SEB can
    // fetch a stale one and silently block the exam.
    cacheControl: "0",
    // Editing a test must replace its config, not fail on a name clash.
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SEB_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Removes a test's config file. Failure is not fatal — the row matters more. */
export async function removeSebConfig(supabase, testId) {
  const { error } = await supabase.storage.from(SEB_BUCKET).remove([`${testId}.seb`]);
  if (error) console.error("Could not remove .seb config:", error.message);
}

/** True when the upload failed because migration 0006 has not been run. */
export function isMissingSebBucket(error) {
  return /bucket not found|does not exist/i.test(error?.message ?? "");
}
