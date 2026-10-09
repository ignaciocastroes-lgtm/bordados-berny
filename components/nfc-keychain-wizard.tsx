"use client"

/**
 * components/nfc-keychain-wizard.tsx
 *
 * Ronda 10 — "Llaveros y etiquetas NFC", el producto estrella de la web
 * pública (bordadosberny.vercel.app) en su versión "hazlo tuyo": hasta
 * ahora solo se cotizaba por WhatsApp, no existía en la WebApp.
 *
 * Mismo patrón que EmbroideryWizard (mismo componente standalone, mismo
 * patrón de subida a Storage que embroidery-wizard.tsx
 * handleProceedToPayment), pero sin pasarela de pago: la cotización es
 * manual, igual que cualquier prenda normal — total_price queda en 0 y
 * Bernardita la fija a mano desde /admin/tickets.
 *
 * Pasos: A) caso de uso → B) logo/diseño (opcional) + contenido del NFC +
 * cantidad → C) confirmación (crea el pedido + draft de nfc_profiles en el
 * servidor) → WhatsApp.
 */

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, X, ArrowLeft, Check, AlertTriangle, Minus, Plus, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useAppStore } from "@/store/useAppStore"
import { NFC_USE_CASES, type NfcUseCase } from "@/lib/nfc"

interface NfcKeychainWizardProps {
  onBack: () => void
  onComplete: () => void
}

export function NfcKeychainWizard({ onBack, onComplete }: NfcKeychainWizardProps) {
  // ── Zustand: fuente de verdad para useCase/content/quantity ───────────────
  const nfc            = useAppStore((s) => s.order.nfc)
  const setNfcUseCase  = useAppStore((s) => s.setNfcUseCase)
  const setNfcContent  = useAppStore((s) => s.setNfcContent)
  const setNfcQuantity = useAppStore((s) => s.setNfcQuantity)

  const { useCase, content, quantity } = nfc

  // ── Local view state ───────────────────────────────────────────────────
  const [step, setStep] = useState<"useCase" | "details" | "confirmation">("useCase")
  const [designImages, setDesignImages] = useState<string[]>([])
  const [designFiles, setDesignFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)
  const [uploadedDesignUrls, setUploadedDesignUrls] = useState<string[]>([])

  const handleSelectUseCase = (id: NfcUseCase) => {
    setNfcUseCase(id)
    setStep("details")
  }

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      setDesignFiles((prev) => [...prev, file])
      const reader = new FileReader()
      reader.onloadend = () => setDesignImages((prev) => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }, [])

  const handleRemoveImage = (index: number) => {
    setDesignImages((prev) => prev.filter((_, i) => i !== index))
    setDesignFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const selectedUseCase = NFC_USE_CASES.find((u) => u.id === useCase)

  const canProceedFromDetails = content.trim().length >= 5 && quantity >= 1

  // ── Submit: sube el diseño (si hay) y crea el pedido ──────────────────────
  const handleSubmitOrder = async () => {
    setSubmitError(null)
    setIsSubmitting(true)

    let designImageUrls: string[] = []
    if (designFiles.length > 0) {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const uploads = await Promise.all(
            designFiles.map(async (file, idx) => {
              const ext = file.name.split(".").pop() || "jpg"
              const path = `${user.id}/llavero-nfc/${Date.now()}-${idx}.${ext}`
              const { error: upErr } = await supabase.storage
                .from("design-uploads")
                .upload(path, file, { contentType: file.type })
              if (upErr) {
                console.error("[NfcKeychainWizard] Error subiendo diseño:", upErr)
                return null
              }
              const { data: signed } = await supabase.storage
                .from("design-uploads")
                .createSignedUrl(path, 60 * 60 * 24 * 365)
              return signed?.signedUrl ?? null
            })
          )
          designImageUrls = uploads.filter((u): u is string => u !== null)
          setUploadedDesignUrls(designImageUrls)
        } else {
          console.error("[NfcKeychainWizard] No hay sesión — no se pudo subir el diseño")
        }
      } catch (err) {
        // No-fatal: el pedido se crea igual sin el logo, como con bordado.
        console.error("[NfcKeychainWizard] Excepción subiendo el diseño:", err)
      }
    }

    const payload = {
      garmentType: "llavero_nfc",
      photos: { front: null, back: null, detail: null },
      designImageUrls,
      description: `Llavero NFC — ${selectedUseCase?.label ?? useCase} — ${quantity} unidad(es). Contenido: ${content}`,
      embroidery: null,
      quantity,
      nfc: { useCase, content },
    }

    console.log("[NfcKeychainWizard] Enviando pedido →", payload)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error("[NfcKeychainWizard] POST /api/orders falló:", { status: res.status, body: data })
        setSubmitError(data?.error ?? `Error ${res.status} al crear el pedido. Intenta de nuevo.`)
        setIsSubmitting(false)
        return
      }

      console.log("[NfcKeychainWizard] Pedido creado con éxito. orderId:", data.orderId)
      setConfirmedOrderId(data.orderId)
      setIsSubmitting(false)
    } catch (err) {
      console.error("[NfcKeychainWizard] Excepción al crear el pedido:", err)
      setSubmitError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.")
      setIsSubmitting(false)
    }
  }

  // wa.me solo manda texto — igual que en wizard-screen.tsx/embroidery-wizard.tsx.
  const buildWhatsAppUrl = () => {
    const ref = confirmedOrderId ? `#${confirmedOrderId.slice(0, 8).toUpperCase()}` : "(pendiente)"
    const photosLine = uploadedDesignUrls.length > 0
      ? `\n\nLogo/diseño:\n${uploadedDesignUrls.join("\n")}`
      : ""
    const msg = `¡Hola Bernardita! Acabo de pedir ${quantity} Llavero(s) NFC — caso de uso: ${selectedUseCase?.label ?? useCase}. Mi número de pedido es ${ref}. ¡Quedo atenta/o a la cotización!${photosLine}`
    return `https://wa.me/56951896142?text=${encodeURIComponent(msg)}`
  }

  // ── Success screen ─────────────────────────────────────────────────────
  if (confirmedOrderId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <Card className="stitch-container w-full max-w-md border-0 shadow-lg">
          <CardContent className="pb-8 pt-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-600">
              <Check className="size-8 text-white" />
            </div>
            <h2 className="mb-1 text-xl font-bold uppercase tracking-wide text-stone-800">Pedido Confirmado</h2>
            <p className="mb-4 font-mono text-xs tracking-widest text-stone-400">
              #{confirmedOrderId.slice(0, 8).toUpperCase()}
            </p>
            <p className="mb-6 text-sm text-stone-500">
              Bernardita revisará tu pedido de llavero NFC y te contactará para confirmar el presupuesto y los detalles.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
              >
                <MessageCircle className="size-5 shrink-0" />
                Avisar a Bernardita por WhatsApp
              </a>
              <button
                onClick={onComplete}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Ver mi pedido
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 p-4 pb-8">
      <div className="mx-auto max-w-lg">
        <header className="mb-6 pt-4">
          <button
            onClick={step === "useCase" ? onBack : () => setStep("useCase")}
            className="mb-3 flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            <ArrowLeft className="size-4" />
            {step === "useCase" ? "Volver a selección" : "Cambiar caso de uso"}
          </button>
          <h1 className="text-balance text-2xl font-bold uppercase tracking-wide text-stone-800">
            Llavero NFC — Hazlo Tuyo
          </h1>
          <p className="mt-1 text-stone-500">Un toque del celular abre tu información. Tú eliges qué.</p>
        </header>

        {/* ── Step A: caso de uso ──────────────────────────────────────────── */}
        {step === "useCase" && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">A</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">¿Para qué lo quieres?</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {NFC_USE_CASES.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUseCase(u.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 bg-white p-4 text-left transition-all hover:border-emerald-400",
                    useCase === u.id ? "border-emerald-600 bg-emerald-50" : "border-stone-200"
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                    {u.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-stone-800">{u.label}</p>
                    <p className="text-xs text-stone-500">{u.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Step B: logo/diseño + contenido + cantidad ───────────────────── */}
        {step === "details" && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">B</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Diseño y contenido</h2>
            </div>

            <Card className="stitch-container mb-4 border-0 shadow-sm">
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">
                    Logo o diseño a grabar (opcional)
                  </Label>
                  <p className="mb-3 text-xs text-stone-500">
                    Si quieres tu logo o un diseño propio en el llavero, súbelo aquí.
                  </p>

                  {designImages.length > 0 && (
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {designImages.map((img, idx) => (
                        <div key={idx} className="relative overflow-hidden rounded-lg border-2 border-emerald-600">
                          <img src={img} alt={`Diseño ${idx + 1}`} className="aspect-square object-cover" />
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-stone-300 bg-white p-6 transition-all hover:border-emerald-400">
                    <input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e.target.files)} className="hidden" />
                    <div className="flex size-12 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                      <Camera className="size-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-stone-700">Toca para subir una imagen</p>
                      <p className="text-xs text-stone-500">PNG, JPG hasta 10MB</p>
                    </div>
                  </label>
                </div>

                <div>
                  <Label htmlFor="nfc-content" className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">
                    ¿Qué quieres que abra el chip?
                  </Label>
                  <Textarea
                    id="nfc-content"
                    placeholder={
                      useCase === "mascota"
                        ? "Ej: Nombre de tu mascota, tu teléfono y una nota si se pierde..."
                        : useCase === "auto"
                        ? "Ej: Tu nombre, teléfono y patente del vehículo..."
                        : useCase === "sos_mochila"
                        ? "Ej: Nombre del niño/a, nombre y teléfono del apoderado, alergias si aplica..."
                        : useCase === "club_deportivo"
                        ? "Ej: Nombre del club, nombre del jugador/socio y rol..."
                        : "Ej: Nombre de tu negocio, WhatsApp, Instagram, catálogo..."
                    }
                    className="min-h-28 border-2 border-stone-200 bg-white resize-none focus:border-emerald-500"
                    value={content}
                    onChange={(e) => setNfcContent(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-stone-400">{content.length} / 500 caracteres</p>
                </div>

                <div>
                  <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">Cantidad</Label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNfcQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                      className="flex size-10 items-center justify-center rounded-lg border-2 border-stone-200 bg-white text-stone-600 transition-colors hover:border-emerald-400 disabled:opacity-40"
                    >
                      <Minus className="size-4" />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setNfcQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-20 text-center border-2 border-stone-200 bg-white focus:border-emerald-500"
                    />
                    <button
                      onClick={() => setNfcQuantity(quantity + 1)}
                      className="flex size-10 items-center justify-center rounded-lg border-2 border-stone-200 bg-white text-stone-600 transition-colors hover:border-emerald-400"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg bg-amber-50 p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700">
                  El precio del llavero NFC se cotiza a mano según cantidad y diseño — Bernardita te confirma el total por WhatsApp.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setStep("confirmation")}
              disabled={!canProceedFromDetails}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
            >
              Continuar
            </Button>
          </section>
        )}

        {/* ── Step C: confirmación ─────────────────────────────────────────── */}
        {step === "confirmation" && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">C</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Confirma tu pedido</h2>
            </div>

            <Card className="border-0 stitch-container shadow-md mb-4">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-xl">
                    {selectedUseCase?.emoji}
                  </span>
                  <div>
                    <p className="text-xs text-stone-500 uppercase tracking-wide">Caso de uso</p>
                    <p className="font-semibold text-stone-800">{selectedUseCase?.label}</p>
                  </div>
                </div>

                {designImages.length > 0 && (
                  <div className="flex gap-2">
                    {designImages.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-100" />
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Contenido</p>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3">{content}</p>
                </div>

                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Cantidad</p>
                  <p className="text-sm font-semibold text-stone-800">{quantity} unidad(es)</p>
                </div>
              </CardContent>
            </Card>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 mb-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("details")} className="flex-1 border-stone-300" disabled={isSubmitting}>
                <ArrowLeft className="mr-1 size-4" />
                Atrás
              </Button>
              <Button
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enviando...
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Enviar Pedido
                  </>
                )}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
