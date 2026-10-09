/**
 * app/mi-llavero/[orderId]/page.tsx  →  /mi-llavero/[orderId]
 *
 * Server wrapper around <NfcProfileEditor/> (components/nfc-profile-editor.tsx).
 * Mismo patrón que el resto de la app: este page.tsx se queda como Server
 * Component puro (sin "use client", sin Supabase) y solo pasa el orderId
 * de la URL al componente de cliente, que hace el fetch/auth/edición real
 * con el cliente de browser. Evita el problema de prerenderizar en build
 * un "use client" que llama a createClient() del browser sin env vars.
 */

export const dynamic = "force-dynamic"

import { NfcProfileEditor } from "@/components/nfc-profile-editor"

export default async function MiLlaveroPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <NfcProfileEditor orderId={orderId} />
}
