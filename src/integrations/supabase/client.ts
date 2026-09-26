import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  const SUPABASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_SUPABASE_URL"]
      : undefined) ||
    (typeof process !== "undefined"
      ? process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]
      : undefined) ||
    "https://placeholder.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
      : undefined) ||
    (typeof process !== "undefined"
      ? process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
      : undefined) ||
    "placeholder-anon-key";

  if (SUPABASE_URL === "https://placeholder.supabase.co") {
    console.warn(
      "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables not provided. Local reactive storage engine active.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/** False when the build has no VITE_SUPABASE_URL (the client then points at a placeholder). */
export function isSupabaseConfigured(): boolean {
  const url =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_SUPABASE_URL"]
      : undefined;
  return typeof url === "string" && url.length > 0 && !url.includes("placeholder");
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
