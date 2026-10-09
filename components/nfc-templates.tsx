/**
 * components/nfc-templates.tsx
 *
 * Ronda 10 (Fase 2) — las 5 plantillas públicas que /nfc/[slug] renderiza
 * según `use_case`. Puramente presentacional (sin "use client", sin
 * Supabase): reciben `template_data` ya resuelto por el Server Component
 * de la página y solo pintan. Mobile-first — es la pantalla que se abre
 * sola al acercar el celular al chip, nunca se navega a ella desde un menú.
 *
 * Mismo lenguaje visual que el resto de la app: bg-stone-50, acentos
 * emerald, stitch-container para las tarjetas.
 */

import type { ReactNode } from "react"
import { Instagram, Globe, ShoppingBag, MessageCircle, Dog, Car, School, Trophy, Briefcase } from "lucide-react"
import { LogoMark } from "@/components/logo-bordados-berny"
import type {
  MascotaTemplateData,
  AutoTemplateData,
  SosMochilaTemplateData,
  ClubDeportivoTemplateData,
  TarjetaDigitalTemplateData,
} from "@/lib/nfc"

function waLink(phone: string | undefined | null, text: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

// Las 5 interfaces en lib/nfc.ts marcan algunos campos como obligatorios —
// correcto para el editor (components/nfc-profile-editor.tsx), que exige
// llenarlos antes de poder publicar. Pero esta vista pública debe seguir
// siendo segura ante cualquier dato incompleto que de todas formas llegue
// acá (un admin que publica antes de que el cliente termine, un registro
// viejo, etc.) — por eso cada plantilla recibe `Partial<...>` y nunca
// asume que un campo exista.

/** Shell compartido — centra la tarjeta, pone el pie de marca. Cada
 *  plantilla define su propio color de acento vía `accentClass`. */
function NfcPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {children}
        <div className="mt-6 flex items-center justify-center gap-2 text-stone-400">
          <LogoMark className="size-5" />
          <p className="text-xs">Llavero NFC por Bordados Berny</p>
        </div>
      </div>
    </div>
  )
}

// ─── Mascota ──────────────────────────────────────────────────────────────────

export function MascotaTemplate({ data }: { data: Partial<MascotaTemplateData> }) {
  const link = waLink(data.owner_phone, `¡Hola! Encontré a ${data.pet_name ?? "tu mascota"}.`)
  return (
    <NfcPageShell>
      <div className="stitch-container rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className="bg-emerald-600 p-6 text-center text-white">
          {data.pet_photo_url ? (
            <img src={data.pet_photo_url} alt={data.pet_name ?? "Mascota"} className="mx-auto mb-3 size-24 rounded-full border-4 border-white object-cover" />
          ) : (
            <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-full border-4 border-white bg-emerald-500">
              <Dog className="size-10 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{data.pet_name ?? "Mascota"}</h1>
          {data.breed && <p className="text-emerald-100 text-sm mt-0.5">{data.breed}</p>}
        </div>
        <div className="bg-white p-5 space-y-3">
          <p className="text-center text-sm text-stone-500">¡Hola! Si me encontraste, por favor contacta a mi familia:</p>
          <p className="text-center font-bold text-stone-800">{data.owner_name ?? "—"}</p>
          {data.note && <p className="text-center text-sm text-stone-600 italic">"{data.note}"</p>}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
            >
              <MessageCircle className="size-5" />
              Avisar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </NfcPageShell>
  )
}

// ─── Auto ─────────────────────────────────────────────────────────────────────

export function AutoTemplate({ data }: { data: Partial<AutoTemplateData> }) {
  const link = waLink(data.owner_phone, `¡Hola! Te contacto por tu vehículo${data.plate ? ` (${data.plate})` : ""}.`)
  return (
    <NfcPageShell>
      <div className="stitch-container rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className="bg-stone-800 p-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-stone-700">
            <Car className="size-9 text-white" />
          </div>
          <h1 className="text-xl font-bold">Vehículo</h1>
          {data.plate && <p className="font-mono text-stone-300 tracking-widest mt-1">{data.plate}</p>}
        </div>
        <div className="bg-white p-5 space-y-3">
          <p className="text-center text-sm text-stone-500">¿Necesitas avisarme algo sobre mi auto?</p>
          <p className="text-center font-bold text-stone-800">{data.owner_name ?? "—"}</p>
          {data.note && <p className="text-center text-sm text-stone-600 italic">"{data.note}"</p>}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
            >
              <MessageCircle className="size-5" />
              Avisar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </NfcPageShell>
  )
}

// ─── SOS Mochila Escolar ──────────────────────────────────────────────────────

export function SosMochilaTemplate({ data }: { data: Partial<SosMochilaTemplateData> }) {
  const link = waLink(data.guardian_phone, `¡Hola! Te contacto por ${data.child_name ?? "un/a estudiante"}.`)
  return (
    <NfcPageShell>
      <div className="stitch-container rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className="bg-amber-500 p-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-amber-400">
            <School className="size-9 text-white" />
          </div>
          <h1 className="text-xl font-bold">SOS Escolar</h1>
          <p className="text-amber-50 text-sm mt-0.5">{data.child_name ?? "—"}</p>
        </div>
        <div className="bg-white p-5 space-y-3">
          <p className="text-center text-sm text-stone-500">En caso de emergencia, contactar a:</p>
          <p className="text-center font-bold text-stone-800">{data.guardian_name ?? "—"}</p>
          {data.allergies_note && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-red-600">Alergias / Notas</p>
              <p className="text-sm text-red-700 mt-0.5">{data.allergies_note}</p>
            </div>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
            >
              <MessageCircle className="size-5" />
              Avisar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </NfcPageShell>
  )
}

// ─── Club Deportivo ───────────────────────────────────────────────────────────

export function ClubDeportivoTemplate({ data }: { data: Partial<ClubDeportivoTemplateData> }) {
  const link = waLink(data.contact_phone, `¡Hola! Te contacto por ${data.club_name ?? "el club"}.`)
  return (
    <NfcPageShell>
      <div className="stitch-container rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className="bg-violet-600 p-6 text-center text-white">
          {data.club_logo_url ? (
            <img src={data.club_logo_url} alt={data.club_name ?? "Club"} className="mx-auto mb-3 size-20 rounded-full border-4 border-white object-cover bg-white" />
          ) : (
            <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full border-4 border-white bg-violet-500">
              <Trophy className="size-9 text-white" />
            </div>
          )}
          <h1 className="text-lg font-bold">{data.club_name ?? "—"}</h1>
        </div>
        <div className="bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            {data.member_photo_url && (
              <img src={data.member_photo_url} alt={data.member_name ?? "Integrante"} className="size-14 rounded-full object-cover border-2 border-violet-100" />
            )}
            <div>
              <p className="font-bold text-stone-800">{data.member_name ?? "—"}</p>
              {data.member_role && <p className="text-xs text-stone-500">{data.member_role}</p>}
            </div>
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
            >
              <MessageCircle className="size-5" />
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </NfcPageShell>
  )
}

// ─── Tarjeta Digital Emprendedor ──────────────────────────────────────────────

export function TarjetaDigitalTemplate({ data }: { data: Partial<TarjetaDigitalTemplateData> }) {
  const waHref = waLink(data.whatsapp_phone, `¡Hola! Vi tu tarjeta digital de ${data.business_name ?? "tu negocio"}.`)
  return (
    <NfcPageShell>
      <div className="stitch-container rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-blue-500">
            <Briefcase className="size-9 text-white" />
          </div>
          <h1 className="text-xl font-bold">{data.business_name ?? "—"}</h1>
          {data.tagline && <p className="text-blue-100 text-sm mt-0.5">{data.tagline}</p>}
        </div>
        <div className="bg-white p-5 space-y-2.5">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <MessageCircle className="size-4 text-[#25D366]" />
              WhatsApp
            </a>
          )}
          {data.instagram_url && (
            <a
              href={data.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <Instagram className="size-4 text-pink-500" />
              Instagram
            </a>
          )}
          {data.website_url && (
            <a
              href={data.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <Globe className="size-4 text-blue-500" />
              Sitio web
            </a>
          )}
          {data.catalog_url && (
            <a
              href={data.catalog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <ShoppingBag className="size-4 text-emerald-600" />
              Catálogo
            </a>
          )}
        </div>
      </div>
    </NfcPageShell>
  )
}
