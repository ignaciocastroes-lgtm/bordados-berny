"use client"

/**
 * components/nfc-profile-editor.tsx
 *
 * Ronda 10 (Fase 2) — "hazlo tuyo": el cliente llena el contenido real de
 * su propio llavero NFC (nombre de su mascota, redes de su negocio, etc.)
 * antes de que Bernardita lo publique desde /admin/tickets. Mientras
 * `is_published` sea false, el dueño del pedido puede leer y escribir su
 * fila en `nfc_profiles` (RLS: "nfc_profiles: owner update own
 * unpublished") — una vez publicado, el formulario queda de solo lectura
 * y solo el admin puede volver a tocarlo.
 *
 * Campos dinámicos por `use_case`, misma fuente de verdad que el resto de
 * la Fase 2: lib/nfc.ts (TemplateData union) y
 * supabase-nfc-keychain-migration.sql (comentario de la columna
 * template_data) — si se agrega un campo a una plantilla hay que
 * actualizar los tres lugares.
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Check, AlertTriangle, ExternalLink, Lock } from "lucide-react"
import { LogoMark } from "@/components/logo-bordados-berny"
import { getUseCaseMeta, type NfcUseCase } from "@/lib/nfc"

interface NfcProfileEditorProps {
  orderId: string
}

interface ProfileRow {
  id: string
  slug: string
  is_published: boolean
  template_data: Record<string, string>
}

interface OrderRow {
  id: string
  garment_type: string
  nfc_use_case: NfcUseCase | null
}

// ─── Campos del formulario por caso de uso ─────────────────────────────────
// (id, etiqueta, tipo, si es obligatorio) — refleja 1:1 las interfaces en
// lib/nfc.ts para cada use_case.
const FIELDS_BY_USE_CASE: Record<NfcUseCase, { id: string; label: string; placeholder: string; required: boolean; type: "text" | "textarea" }[]> = {
  mascota: [
    { id: "pet_name",    label: "Nombre de tu mascota", placeholder: "Ej: Luna",                    required: true,  type: "text" },
    { id: "breed",       label: "Raza (opcional)",      placeholder: "Ej: Mestiza",                  required: false, type: "text" },
    { id: "owner_name",  label: "Tu nombre",            placeholder: "Ej: María González",           required: true,  type: "text" },
    { id: "owner_phone", label: "Tu WhatsApp",          placeholder: "Ej: 56912345678",               required: true,  type: "text" },
    { id: "note",        label: "Nota (opcional)",      placeholder: "Ej: Es muy cariñosa, no muerde",required: false, type: "textarea" },
  ],
  auto: [
    { id: "owner_name",  label: "Tu nombre",   placeholder: "Ej: Juan Pérez",     required: true,  type: "text" },
    { id: "owner_phone", label: "Tu WhatsApp", placeholder: "Ej: 56912345678",     required: true,  type: "text" },
    { id: "plate",       label: "Patente (opcional)", placeholder: "Ej: ABCD12",   required: false, type: "text" },
    { id: "note",        label: "Nota (opcional)", placeholder: "Ej: Avisar si está mal estacionado", required: false, type: "textarea" },
  ],
  sos_mochila: [
    { id: "child_name",      label: "Nombre del niño/a",    placeholder: "Ej: Martina",        required: true,  type: "text" },
    { id: "guardian_name",   label: "Nombre del apoderado", placeholder: "Ej: Carla Soto",      required: true,  type: "text" },
    { id: "guardian_phone",  label: "WhatsApp del apoderado", placeholder: "Ej: 56912345678",   required: true,  type: "text" },
    { id: "allergies_note",  label: "Alergias / notas (opcional)", placeholder: "Ej: Alérgica al maní", required: false, type: "textarea" },
  ],
  club_deportivo: [
    { id: "club_name",    label: "Nombre del club",         placeholder: "Ej: Club Deportivo Andes", required: true,  type: "text" },
    { id: "member_name",  label: "Nombre del jugador/socio", placeholder: "Ej: Diego Fuentes",       required: true,  type: "text" },
    { id: "member_role",  label: "Rol (opcional)",           placeholder: "Ej: Capitán, Socio Nº12",  required: false, type: "text" },
    { id: "contact_phone", label: "WhatsApp de contacto (opcional)", placeholder: "Ej: 56912345678",  required: false, type: "text" },
  ],
  tarjeta_digital: [
    { id: "business_name",  label: "Nombre de tu negocio", placeholder: "Ej: Panadería La Espiga", required: true,  type: "text" },
    { id: "tagline",        label: "Frase corta (opcional)", placeholder: "Ej: Pan artesanal todos los días", required: false, type: "text" },
    { id: "whatsapp_phone", label: "WhatsApp (opcional)",  placeholder: "Ej: 56912345678",          required: false, type: "text" },
    { id: "instagram_url",  label: "Instagram (opcional)", placeholder: "Ej: https://instagram.com/tu_negocio", required: false, type: "text" },
    { id: "website_url",    label: "Sitio web (opcional)", placeholder: "Ej: https://tunegocio.cl", required: false, type: "text" },
    { id: "catalog_url",    label: "Catálogo (opcional)",  placeholder: "Ej: link a tu catálogo",   required: false, type: "text" },
  ],
}

export function NfcProfileEditor({ orderId }: NfcProfileEditorProps) {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading]   = useState(true)
  const [order, setOrder]       = useState<OrderRow | null>(null)
  const [profile, setProfile]   = useState<ProfileRow | null>(null)
  const [fields, setFields]     = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace("/")
      return
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("id, garment_type, nfc_use_case")
      .eq("id", orderId)
      .maybeSingle()

    if (orderErr || !orderData || orderData.garment_type !== "llavero_nfc") {
      setLoadError("No encontramos este pedido de llavero NFC.")
      setLoading(false)
      return
    }
    setOrder(orderData as OrderRow)

    const { data: profileData, error: profileErr } = await supabase
      .from("nfc_profiles")
      .select("id, slug, is_published, template_data")
      .eq("order_id", orderId)
      .maybeSingle()

    if (profileErr || !profileData) {
      setLoadError("Este pedido todavía no tiene un perfil NFC asociado. Escríbenos por WhatsApp si crees que es un error.")
      setLoading(false)
      return
    }

    setProfile(profileData as ProfileRow)
    setFields((profileData.template_data ?? {}) as Record<string, string>)
    setLoading(false)
  }, [orderId, router]) // eslint-disable-line

  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const useCase = order?.nfc_use_case ?? null
  const useCaseMeta = getUseCaseMeta(useCase)
  const formFields = useCase ? FIELDS_BY_USE_CASE[useCase] : []
  const isReadOnly = !!profile?.is_published

  const handleFieldChange = (id: string, value: string) => {
    setFields((prev) => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  const canSave = formFields.every((f) => !f.required || (fields[f.id] ?? "").trim().length > 0)

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    const { error } = await supabase
      .from("nfc_profiles")
      .update({ template_data: fields })
      .eq("id", profile.id)

    if (error) {
      console.error("[NfcProfileEditor] Error guardando template_data:", error)
      setSaveError("No se pudo guardar. Intenta de nuevo.")
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
      </div>
    )
  }

  if (loadError || !order || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <Card className="stitch-container w-full max-w-sm border-0 shadow-lg">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertTriangle className="mx-auto mb-3 size-8 text-amber-500" />
            <p className="text-sm text-stone-600">{loadError}</p>
            <button
              onClick={() => router.push("/tracker")}
              className="mt-4 flex items-center justify-center gap-1 text-sm text-stone-500 hover:text-stone-700 w-full"
            >
              <ArrowLeft className="size-4" />
              Volver a mis pedidos
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="stitch-container sticky top-0 z-10 flex items-center gap-3 px-4 py-3 shadow-sm">
        <button
          onClick={() => router.push("/tracker")}
          className="p-1 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoMark className="size-8 shrink-0" />
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Hazlo Tuyo</p>
          <h1 className="text-sm font-bold text-stone-800">{useCaseMeta?.label ?? "Llavero NFC"}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {isReadOnly && (
          <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-stone-400" />
            <p className="text-sm text-stone-500">
              Tu llavero ya fue publicado — para cambiar el contenido ahora, escríbele a Bernardita por WhatsApp.
            </p>
          </div>
        )}

        {profile.is_published && (
          <a
            href={`/nfc/${profile.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ExternalLink className="size-4" />
            Ver mi página pública
          </a>
        )}

        <Card className="stitch-container border-0 shadow-sm">
          <CardContent className="space-y-4 pt-4">
            {formFields.map((f) => (
              <div key={f.id}>
                <Label htmlFor={f.id} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-800">
                  {f.label}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.id}
                    placeholder={f.placeholder}
                    value={fields[f.id] ?? ""}
                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                    disabled={isReadOnly}
                    className="min-h-20 border-stone-200 bg-white resize-none focus:border-emerald-500 focus:ring-emerald-500 disabled:opacity-60"
                  />
                ) : (
                  <Input
                    id={f.id}
                    placeholder={f.placeholder}
                    value={fields[f.id] ?? ""}
                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                    disabled={isReadOnly}
                    className="border-stone-200 bg-white focus:border-emerald-500 disabled:opacity-60"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {!isReadOnly && (
          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Guardando...
              </span>
            ) : saved ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Guardado
              </span>
            ) : (
              "Guardar"
            )}
          </Button>
        )}

        {!isReadOnly && (
          <p className="text-center text-xs text-stone-400">
            Bernardita publicará tu llavero cuando esté listo. Puedes seguir editando hasta entonces.
          </p>
        )}
      </div>
    </div>
  )
}
