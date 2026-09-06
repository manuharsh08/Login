/**
 * Attestation: how the exam server knows a request came from this browser,
 * running these restrictions, rather than from Chrome.
 *
 * Modelled on Safe Exam Browser's Config Key / Browser Exam Key:
 *
 *   configKey   = SHA256(canonical security config)
 *   requestHash = SHA256(url + configKey + appSecret)
 *
 * The app sends requestHash on every exam request; the server recomputes it
 * and refuses anything that does not match. Because the URL is inside the
 * hash, a captured header cannot be replayed against a different endpoint.
 *
 * Honest limit: appSecret ships inside the application, and an Electron app
 * can be unpacked. This raises the cost of cheating; it is not unforgeable.
 * Keep the server checks (session binding, timing, one attempt per student)
 * as the real defence.
 */
import { createHash } from "node:crypto";

/**
 * Stable stringify: key order must not change the hash, or two identical
 * configs would produce different keys on different machines.
 */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;

  if (value && typeof value === "object") {
    const body = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",");
    return `{${body}}`;
  }

  return JSON.stringify(value ?? null);
}

const sha256 = input => createHash("sha256").update(input, "utf8").digest("hex");

/** Fingerprint of the security settings this build is enforcing. */
export function configKey(security) {
  return sha256(canonical(security));
}

/**
 * Per-request proof. The query string is stripped so that cache-busting or
 * tracking parameters do not break verification, which means the server must
 * strip it the same way.
 */
export function requestHash(url, key, appSecret) {
  let normalised = url;

  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    normalised = parsed.href;
  } catch {
    // Not a parseable URL: hash it verbatim rather than silently allowing it.
  }

  return sha256(`${normalised}${key}${appSecret}`);
}

/** Constant-time compare, so a wrong password cannot be found byte by byte. */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { sha256 };
