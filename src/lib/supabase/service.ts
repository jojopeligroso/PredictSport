import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses all RLS policies.
 * Use for server-side writes that manage shared state (group allocation,
 * classification enrollment, scoring) where the authenticated user may
 * not have admin-level RLS permissions.
 *
 * NEVER expose this client to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}
