/**
 * lib/nfc.ts
 *
 * Fuente de verdad (TS) para el producto "Llavero NFC" — Ronda 10. Server-
 * safe (sin "use client"), igual que lib/pricing.ts: tanto el wizard del
 * cliente, la API de creación de pedidos, el editor de perfil y las
 * plantillas públicas importan desde acá.
 *
 * La forma de cada `template_data` está documentada en paralelo en el
 * comentario de la columna `nfc_profiles.template_data`
 * (supabase-nfc-keychain-migration.sql) — si se agrega un campo acá,
 * agregarlo también ahí.
 */

export type NfcUseCase = "sos_mochila" | "club_deportivo" | "mascota" | "tarjeta_digital" | "auto"

export const NFC_USE_CASES: { id: NfcUseCase; label: string; description: string; emoji: string }[] = [
  {
    id: "sos_mochila",
    label: "SOS Mochila Escolar",
    description: "Datos del apoderado a un toque — para la mochila o el estuche del colegio.",
    emoji: "🎒",
  },
  {
    id: "club_deportivo",
    label: "Club Deportivo",
    description: "Escudo del club + ficha del jugador o socio.",
    emoji: "🏅",
  },
  {
    id: "mascota",
    label: "Mascota",
    description: "Placa con la información de tu mascota — quien la encuentre puede contactarte.",
    emoji: "🐾",
  },
  {
    id: "tarjeta_digital",
    label: "Tarjeta Digital Emprendedor",
    description: "Catálogo, redes sociales y WhatsApp de tu negocio en un solo toque.",
    emoji: "💼",
  },
  {
    id: "auto",
    label: "Llavero de Auto",
    description: "Contacto del dueño y datos del vehículo, por si alguien necesita avisarte algo.",
    emoji: "🚗",
  },
]

export function getUseCaseMeta(useCase: NfcUseCase | null | undefined) {
  return NFC_USE_CASES.find((u) => u.id === useCase) ?? null
}

// ─── Forma de template_data por caso de uso ───────────────────────────────────

export interface MascotaTemplateData {
  pet_name: string
  pet_photo_url?: string | null
  breed?: string
  owner_name: string
  owner_phone: string
  note?: string
}

export interface AutoTemplateData {
  owner_name: string
  owner_phone: string
  plate?: string
  note?: string
}

export interface SosMochilaTemplateData {
  child_name: string
  guardian_name: string
  guardian_phone: string
  allergies_note?: string
}

export interface ClubDeportivoTemplateData {
  club_name: string
  member_name: string
  member_role?: string
  club_logo_url?: string | null
  member_photo_url?: string | null
  contact_phone?: string
}

export interface TarjetaDigitalTemplateData {
  business_name: string
  tagline?: string
  whatsapp_phone?: string
  instagram_url?: string
  website_url?: string
  catalog_url?: string
}

export type TemplateData =
  | MascotaTemplateData
  | AutoTemplateData
  | SosMochilaTemplateData
  | ClubDeportivoTemplateData
  | TarjetaDigitalTemplateData

// ─── Slug para la URL pública (/nfc/[slug]) ───────────────────────────────────

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // sin 0/o/1/i/l — se confunden al transcribir a mano
const SLUG_LENGTH = 8

/** Genera un slug corto y legible. No garantiza unicidad por sí solo — el
 *  caller reintenta si la BD rechaza por choque de `unique`. */
export function generateNfcSlug(): string {
  let slug = ""
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]
  }
  return slug
}

export function isNfcUseCase(v: unknown): v is NfcUseCase {
  return typeof v === "string" && NFC_USE_CASES.some((u) => u.id === v)
}
