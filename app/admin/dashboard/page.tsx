/**
 * app/admin/dashboard/page.tsx  →  /admin/dashboard
 *
 * Centro de Mando — Master Coordination Dashboard.
 * Drop-in replacement for the original <CommandCenter /> component.
 * No local state changes needed; CommandCenter was already self-contained.
 *
 * FIX (root cause): this page has no "use client" of its own, so Next.js
 * treated it as a static server page and tried to prerender it at build
 * time — which means rendering <CommandCenter/> once on the server to
 * produce the static HTML shell. CommandCenter calls Supabase's
 * createClient() (lib/supabase/client.ts) during render, and that build
 * step runs in an isolated environment without the Supabase env vars
 * available, so it threw "Your project's URL and API key are required".
 * This page is 100% auth-gated admin data anyway (nothing on it can be
 * statically generated), so force-dynamic tells Next to skip prerendering
 * it altogether and render it per-request instead, where the real runtime
 * env vars exist.
 */

export const dynamic = "force-dynamic"

import { CommandCenter } from "@/components/command-center"

export default function AdminDashboardPage() {
  return <CommandCenter />
}
