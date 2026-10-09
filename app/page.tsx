/**
 * app/page.tsx  →  /
 *
 * Server wrapper around <LoginScreen/> (components/login-screen.tsx).
 *
 * FIX (root cause): this used to be the whole login screen marked
 * "use client" directly in page.tsx. Next.js still tried to prerender it
 * at build time (the "use client" directive doesn't exempt a page from
 * static generation by itself), which runs the screen's body — including
 * Supabase's createClient() — once in Node during the build, where the
 * Supabase env vars aren't available. That crashed the Vercel build with
 * "@supabase/ssr: Your project's URL and API key are required".
 *
 * The admin pages (app/admin/dashboard, app/admin/kanban) already used the
 * pattern that actually works: a Server Component page.tsx with
 * `dynamic = "force-dynamic"` that imports a separate "use client"
 * component. This page now follows the same pattern.
 */

export const dynamic = "force-dynamic"

import { LoginScreen } from "@/components/login-screen"

export default function LoginPage() {
  return <LoginScreen />
}
