import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Fail loudly and early when config is missing. Without this, an undefined value
 * builds a malformed URL and only surfaces later as "TypeError: fetch failed".
 */
function assertConfigured(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * Browser/client-side Supabase client.
 * Uses anon key — subject to Row Level Security policies.
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Server-side Supabase client for Next.js API routes.
 * Reads Clerk session cookies to enforce RLS on behalf of the user.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });
}

/**
 * Admin client for privileged server-only operations.
 * Bypasses RLS — never expose this to the client.
 */
export function createAdminClient() {
  return createClient(
    assertConfigured("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    assertConfigured("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceKey),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
