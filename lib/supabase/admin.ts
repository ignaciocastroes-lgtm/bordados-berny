/**
 * lib/supabase/admin.ts
 *
 * Service-role Supabase client — bypasses RLS entirely.
 *
 * ONLY for trusted server-to-server contexts with no user session to check
 * against RLS, such as the Mercado Pago webhook (api/payment/mp-webhook):
 * MP calls that endpoint directly, with no Supabase cookie/session at all,
 * so the normal server client (lib/supabase/server.ts) would have no
 * logged-in user and every update would be denied by RLS. Never import
 * this in a route that handles a browser request on behalf of a specific
 * user — use lib/supabase/server.ts there so RLS still applies.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno."
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
