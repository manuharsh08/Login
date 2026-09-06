import { supabase } from "./supabase.js";

/**
 * Halts the calling module forever. Assigning `location.href` only *schedules*
 * a navigation, so without this the rest of the page script keeps running
 * against a null user and throws. Awaiting a promise that never settles stops
 * execution cleanly while the browser navigates away.
 */
function haltForRedirect(target) {
  location.replace(target);
  return new Promise(() => {});
}

/** Resolves with the signed-in user, or redirects to the login page. */
export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    // Carry the destination through the login page. Inside Safe Exam Browser
    // the session always starts empty, so a student opening an exam link would
    // otherwise sign in and land on the dashboard instead of their exam.
    const next = `${location.pathname.split("/").pop()}${location.search}`;
    return haltForRedirect(`index.html?next=${encodeURIComponent(next)}`);
  }
  return data.user;
}

/** Resolves with the signed-in user only if they hold the `admin` role. */
export async function requireAdmin() {
  const user = await requireUser();

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    console.error("Role lookup failed:", error.message);
    return haltForRedirect("dashboard.html");
  }
  if (data?.role !== "admin") {
    return haltForRedirect("dashboard.html");
  }
  return user;
}

/** Looks up a role without redirecting. Returns "student" when unknown. */
export async function getRole(email) {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Role lookup failed:", error.message);
    return "student";
  }
  return data?.role ?? "student";
}

/** Signs out and returns to the login page. */
export async function signOut() {
  await supabase.auth.signOut();
  location.replace("index.html");
}

/** Wires any element with `data-logout` to the sign-out flow. */
export function wireLogout(root = document) {
  root.querySelectorAll("[data-logout]").forEach(el => {
    el.addEventListener("click", signOut);
  });
}

/** Display name for a user, falling back to the email local-part. */
export function displayName(user) {
  return user.user_metadata?.name?.trim() || user.email.split("@")[0];
}
