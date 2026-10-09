/**
 * app/tracker/page.tsx  →  /tracker
 *
 * Server wrapper around <TrackerScreen/> (components/tracker-screen.tsx).
 * See app/page.tsx (login) for the full explanation of why this file is a
 * thin Server Component instead of a "use client" page directly: Next.js
 * doesn't reliably skip build-time prerendering for a "use client" page.tsx
 * even with `export const dynamic = "force-dynamic"` in the same file, and
 * this screen's body calls Supabase's createClient() during render —
 * which crashed the Vercel build when run at build time, with no env vars.
 */

export const dynamic = "force-dynamic"

import { TrackerScreen } from "@/components/tracker-screen"

export default function TrackerPage() {
  return <TrackerScreen />
}
