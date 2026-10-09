/**
 * app/nfc/[slug]/page.tsx  →  /nfc/[slug]
 *
 * Ronda 10 (Fase 2) — la página real que el chip NFC abre cuando alguien
 * acerca el celular al llavero. A diferencia del resto de la app, este
 * Server Component SÍ llama a Supabase directamente en el propio page.tsx:
 * no tiene lógica de cliente (no hay "use client", no hay interactividad,
 * nada de sessionStorage/Zustand), así que no aplica la razón por la que
 * el resto de las páginas separan un componente — esa regla es sobre evitar
 * que Next intente prerenderizar en build-time un componente "use client"
 * que llama a createClient() del browser. Acá es exactamente el patrón
 * correcto para una página pública que debe verse rápido sin login.
 *
 * `is_published`/el resto de las columnas ya están cubiertas por RLS
 * ("nfc_profiles: public read published" + "nfc_profiles: owner/admin
 * read") — este fetch corre con el cliente de servidor autenticado con las
 * cookies de quien sea que esté mirando (anónimo la mayoría de las veces).
 * Si la fila no vuelve, es porque no existe el slug o porque todavía no
 * está publicada y quien mira no es ni el dueño ni el admin — en ambos
 * casos se muestra el mismo estado "no disponible", sin distinguir, para
 * no filtrar si un slug existe o no.
 */

export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { LogoMark } from "@/components/logo-bordados-berny"
import {
  MascotaTemplate,
  AutoTemplate,
  SosMochilaTemplate,
  ClubDeportivoTemplate,
  TarjetaDigitalTemplate,
} from "@/components/nfc-templates"
import type {
  MascotaTemplateData,
  AutoTemplateData,
  SosMochilaTemplateData,
  ClubDeportivoTemplateData,
  TarjetaDigitalTemplateData,
} from "@/lib/nfc"

function NotAvailable() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <LogoMark className="mx-auto mb-4 size-10" />
        <h1 className="text-lg font-bold text-stone-800">Este llavero no está disponible</h1>
        <p className="mt-2 text-sm text-stone-500">
          El contenido aún no fue publicado o el enlace no es válido. Si crees que esto es un error, contacta a Bordados Berny.
        </p>
      </div>
    </div>
  )
}

export default async function NfcProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from("nfc_profiles")
    .select("use_case, is_published, template_data")
    .eq("slug", slug)
    .maybeSingle()

  if (error || !profile || !profile.is_published) {
    return <NotAvailable />
  }

  const data = (profile.template_data ?? {}) as Record<string, unknown>

  switch (profile.use_case) {
    case "mascota":
      return <MascotaTemplate data={data as unknown as Partial<MascotaTemplateData>} />
    case "auto":
      return <AutoTemplate data={data as unknown as Partial<AutoTemplateData>} />
    case "sos_mochila":
      return <SosMochilaTemplate data={data as unknown as Partial<SosMochilaTemplateData>} />
    case "club_deportivo":
      return <ClubDeportivoTemplate data={data as unknown as Partial<ClubDeportivoTemplateData>} />
    case "tarjeta_digital":
      return <TarjetaDigitalTemplate data={data as unknown as Partial<TarjetaDigitalTemplateData>} />
    default:
      return <NotAvailable />
  }
}
