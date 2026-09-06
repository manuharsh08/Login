import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase configuration. Copy .env.example to .env and set " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

/** Uploads an avatar to the `avatars` bucket and returns its public URL. */
export async function uploadAvatar(file, userId) {
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * True when a query failed because the table does not exist yet — i.e. a
 * migration in supabase/migrations/ has not been run. PostgREST reports this
 * as PGRST205 ("not found in the schema cache") with a 404.
 */
export function isMissingTable(error) {
  return error?.code === "PGRST205";
}

/** Message pointing at the migration that creates a missing table. */
export function setupHint(feature, migrationFile) {
  return `${feature} are not set up yet. Run supabase/migrations/${migrationFile}.`;
}
