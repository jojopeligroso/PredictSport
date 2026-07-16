import { isWorldCupArchive } from "@/lib/product-mode";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the appropriate Supabase client for reading data.
 *
 * Archive mode: service client (bypasses RLS, no auth session).
 * Normal mode: cookie-based server client.
 */
export async function getReadClient() {
  if (isWorldCupArchive()) {
    return createServiceClient();
  }
  return createClient();
}
