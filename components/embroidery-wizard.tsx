"use client"

/**
 * components/embroidery-wizard.tsx
 *
 * Refactored: pricing state (mode, size, calculatedPrice, hasTextDiscount)
 * now lives entirely in Zustand via useAppStore.
 *
 * What changed vs. original:
 *   REMOVED  →  local useState for `mode`, `size`
 *   REMOVED  →  local derivations of `calculatedPrice`, `hasTextDiscount`, `originalTextPrice`
 *   ADDED    →  useAppStore selectors for the same values
 *   ADDED    →  calls to setEmbroideryMode / setEmbroiderySize on selection
 *   KEPT     →  all UI, all local state that is pure view (step, embroideryText,
 *               fontStyle, designImages, additionalDetails, scheduledDate/Time,
 *               showPayment, isSubmitted) — these don't need to survive navigation
 *   KEPT     →  SIZE_OPTIONS table (still used for display metadata like maxChars)
 *   KEPT     →  all JSX verbatim — zero visual changes
 */

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Camera,
  X,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Type,
  AlertTriangle,
  Mail,
  MessageCircle,
  Calendar,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { PaymentModal, type PaymentResult } from "./payment-modal"
import {
  useAppStore,
  type EmbroideryMode,
  type EmbroiderySize,
} from "@/store/useAppStore"

// ─── Types & constants (local display metadata only) ──────────────────────────

type FontStyle = "script" | "serif" | "sans"

interface SizeOption {
  id: EmbroiderySize
  label: string
  dimensions: string
  imagePrice: number   // kept for display (strikethrough) — source of truth is the store
  textPrice: number    // idem
  maxChars: number
}

const SIZE_OPTIONS: SizeOption[] = [
  { id: "10x10", label: "Pequeno", dimensions: "10 x 10 cm", imagePrice: 3000,  textPrice: 3000,  maxChars: 15 },
  { id: "13x18", label: "Mediano", dimensions: "13 x 18 cm", imagePrice: 7000,  textPrice: 5600,  maxChars: 25 },
  { id: "18x26", label: "Grande",  dimensions: "18 x 26 cm", imagePrice: 10000, textPrice: 8000,  maxChars: 40 },
]

const FONT_OPTIONS: { id: FontStyle; label: string; description: string }[] = [
  { id: "script", label: "Elegante / Script", description: "Cursiva decorativa" },
  { id: "serif",  label: "Clasica / Serif",   description: "Times, Georgia" },
  { id: "sans",   label: "Moderna / Sans",    description: "Arial, Helvetica" },
]

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmbroideryWizardProps {
  onBack: () => void
  onComplete: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmbroideryWizard({ onBack, onComplete }: EmbroideryWizardProps) {

  // ── Zustand: pricing state (single source of truth) ──────────────────────
  const embroidery        = useAppStore((s) => s.order.embroidery)
  const setEmbroideryMode = useAppStore((s) => s.setEmbroideryMode)
  const setEmbroiderySize = useAppStore((s) => s.setEmbroiderySize)

  // Destructure for ergonomics
  const mode             = embroidery.mode
  const size             = embroidery.size
  const calculatedPrice  = embroidery.calculatedPrice
  const hasTextDiscount  = embroidery.hasTextDiscount

  // ── Local state: pure view (does not need to survive navigation) ──────────
  const [step, setStep] = useState<"mode" | "size" | "input" | "schedule">("mode")

  const [embroideryText,    setEmbroideryText]    = useState("")
  const [fontStyle,         setFontStyle]         = useState<FontStyle | null>(null)
  // `designImages` = preview data URLs (unchanged, used for the grid below).
  // `designFiles` = the real Blobs — FIX (root cause): previously only the
  // data URL ever existed, so Bernardita's reference image was thrown away
  // the moment the tab closed. These get uploaded for real in
  // handleProceedToPayment, in the same order as `designImages`.
  const [designImages,      setDesignImages]      = useState<string[]>([])
  const [designFiles,       setDesignFiles]       = useState<File[]>([])
  const [additionalDetails, setAdditionalDetails] = useState("")
  const [scheduledDate,     setScheduledDate]     = useState("")
  const [scheduledTime,     setScheduledTime]     = useState("")

  const [showPayment,      setShowPayment]      = useState(false)
  const [isSubmitted,      setIsSubmitted]      = useState(false)
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)
  const [paymentMethod,    setPaymentMethod]    = useState<"mercadopago" | "transfer" | null>(null)
  const [isCreatingOrder,  setIsCreatingOrder]  = useState(false)
  const [createError,      setCreateError]      = useState<string | null>(null)
  const [createdOrderId,   setCreatedOrderId]   = useState<string | null>(null)

  // ── Derived display values ────────────────────────────────────────────────
  const selectedSize = SIZE_OPTIONS.find((s) => s.id === size)

  // The "original" (pre-discount) price shown struck-through in text mode
  const originalTextPrice = selectedSize
    ? (size === "13x18" ? 7000 : size === "18x26" ? 10000 : selectedSize.textPrice)
    : 0

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectMode = (m: EmbroideryMode) => {
    setEmbroideryMode(m)   // ← Zustand: updates mode + recalculates price
    setStep("size")
  }

  const handleSelectSize = (s: EmbroiderySize) => {
    setEmbroiderySize(s)   // ← Zustand: updates size + recalculates price
    setStep("input")
  }

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      setDesignFiles((prev) => [...prev, file])
      const reader = new FileReader()
      reader.onloadend = () => {
        setDesignImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleRemoveImage = (index: number) => {
    setDesignImages((prev) => prev.filter((_, i) => i !== index))
    setDesignFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Create the order in Supabase BEFORE opening the payment modal ──────────
  // This is the fix for the root cause: previously nothing ever called
  // POST /api/orders, so no row was ever inserted and no ticket number existed.
  const handleProceedToPayment = async () => {
    setCreateError(null)
    setIsCreatingOrder(true)

    // FIX (root cause): `designFiles` used to only ever become a base64
    // preview — Bernardita was digitizing with zero reference image. Upload
    // them for real before creating the order, so their URLs can be saved.
    let designImageUrls: string[] = []
    if (mode === "image" && designFiles.length > 0) {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const uploads = await Promise.all(
            designFiles.map(async (file, idx) => {
              const ext = file.name.split(".").pop() || "jpg"
              const path = `${user.id}/disenos/${Date.now()}-${idx}.${ext}`
              const { error: upErr } = await supabase.storage
                .from("design-uploads")
                .upload(path, file, { contentType: file.type })
              if (upErr) {
                console.error("[EmbroideryWizard] Error subiendo imagen de diseño:", upErr)
                return null
              }
              const { data: signed } = await supabase.storage
                .from("design-uploads")
                .createSignedUrl(path, 60 * 60 * 24 * 365)
              return signed?.signedUrl ?? null
            })
          )
          designImageUrls = uploads.filter((u): u is string => u !== null)
        }
      } catch (err) {
        // Non-fatal — the order still gets created with the text
        // description; Bernardita just won't have the reference image.
        console.error("[EmbroideryWizard] Excepción subiendo imágenes de diseño:", err)
      }
    }

    const payload = {
      garmentType: "bordado",
      photos: { front: null, back: null, detail: null },
      designImageUrls,
      description: additionalDetails ||
        `Bordado ${mode === "image" ? "de imagen" : "de texto"} — tamaño ${size} — ${embroideryText || "sin texto especificado"}`,
      embroidery: {
        mode,
        size,
        text: mode === "text" ? embroideryText : null,
        fontStyle: mode === "text" ? fontStyle : null,
        scheduledDate,
        scheduledTime,
        calculatedPrice,
        hasTextDiscount,
      },
    }

    console.log("[EmbroideryWizard] Creando pedido en Supabase →", payload)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        // Surface the exact server error instead of failing silently
        console.error("[EmbroideryWizard] POST /api/orders falló:", {
          status: res.status,
          body: data,
        })
        setCreateError(
          data?.error ?? `Error ${res.status}: no se pudo crear el pedido. Intenta de nuevo.`
        )
        setIsCreatingOrder(false)
        return // ← do NOT open the payment modal if the order wasn't created
      }

      console.log("[EmbroideryWizard] Pedido creado con éxito. orderId:", data.orderId)
      setCreatedOrderId(data.orderId)
      setIsCreatingOrder(false)
      setShowPayment(true)

    } catch (err) {
      // Network failure, JSON parse failure, etc.
      console.error("[EmbroideryWizard] Excepción al crear el pedido:", err)
      setCreateError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.")
      setIsCreatingOrder(false)
    }
  }

  const handlePaymentSuccess = async (result: PaymentResult) => {
    setShowPayment(false)
    // The order was already created in handleProceedToPayment — use that ID.
    // result.orderId is kept as a fallback in case PaymentModal ever creates
    // its own order in the future (e.g. real MP webhook flow).
    const finalOrderId = result.orderId ?? createdOrderId
    setConfirmedOrderId(finalOrderId)
    setPaymentMethod(result.paymentMethod)
    setIsSubmitted(true)

    // ── Persist payment method + status to Supabase ──────────────────────
    if (finalOrderId) {
      try {
        const res = await fetch(`/api/orders/${finalOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_provider: result.paymentMethod,
            payment_status:   result.paymentStatus,
            delivery_option:  result.deliveryOption,
            delivery_address: result.deliveryAddress,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          console.error("[EmbroideryWizard] PATCH payment status falló:", data)
        } else {
          console.log("[EmbroideryWizard] Estado de pago actualizado:", result.paymentMethod, result.paymentStatus)
        }
      } catch (err) {
        console.error("[EmbroideryWizard] Excepción actualizando el pago:", err)
      }
    } else {
      console.warn("[EmbroideryWizard] No hay orderId — no se pudo actualizar el estado de pago.")
    }

    // No auto-navigate: user chooses between "Ver mi pedido" and WhatsApp
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  const canProceedFromInput =
    mode === "image"
      ? designImages.length > 0
      : embroideryText.trim().length > 0 && fontStyle !== null

  const canProceedFromSchedule = !!(scheduledDate && scheduledTime)

  // ── WhatsApp deep-link ────────────────────────────────────────────────────
  const GARMENT_LABELS: Record<string, string> = {
    pantalon: "Pantalón",
    short:    "Short",
    blusa:    "Blusa",
    polera:   "Polera",
    poleron:  "Polerón",
    otro:     "prenda",
    bordado:  "Bordado / Matriz Digital",
  }

  const buildWhatsAppUrl = () => {
    const garmentLabel = GARMENT_LABELS["bordado"]
    const modeLabel    = mode === "image" ? "Imagen" : "Texto"
    const sizeLabel    = selectedSize?.dimensions ?? size ?? ""
    const orderRef     = confirmedOrderId
      ? `#${confirmedOrderId.slice(0, 8).toUpperCase()}`
      : "(pendiente)"

    // Core message — same for both methods
    const core = [
      `¡Hola Bernardita! Acabo de ingresar un nuevo ticket en la App.`,
      `Mi número de pedido es ${orderRef} para un/a ${garmentLabel} — Modo ${modeLabel}, tamaño ${sizeLabel}.`,
    ].join(" ")

    // Closing line branches on payment method
    const closing = paymentMethod === "transfer"
      ? `Te adjunto el comprobante de transferencia para que puedas validar mi pago y agendar el pedido.`
      : `¡Quedo atenta/o a la confirmación!`

    return `https://wa.me/56951896142?text=${encodeURIComponent(`${core} ${closing}`)}`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — all JSX kept verbatim from original; only data sources changed
  // ─────────────────────────────────────────────────────────────────────────

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <Card className="stitch-container w-full max-w-md border-0 shadow-lg">
          <CardContent className="pb-8 pt-8 text-center">

            {/* Check circle */}
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-600">
              <Check className="size-8 text-white" />
            </div>

            <h2 className="mb-1 text-xl font-bold uppercase tracking-wide text-stone-800">
              Pedido Confirmado
            </h2>

            {/* Order ID pill */}
            {confirmedOrderId && (
              <p className="mb-3 text-xs font-mono text-stone-400 tracking-widest">
                #{confirmedOrderId.slice(0, 8).toUpperCase()}
              </p>
            )}

            <p className="mb-2 text-sm text-stone-500">
              Tu archivo .pes sera enviado a tu correo electronico una vez completado.
            </p>

            {/* Email notice */}
            <div className="mt-4 rounded-lg bg-blue-50 p-3">
              <Mail className="mx-auto mb-1 size-5 text-blue-500" />
              <p className="text-sm text-blue-700">Recibiras el archivo digital en tu email</p>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3">

              {/* Primary: WhatsApp to Bernardita */}
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
              >
                <MessageCircle className="size-5 shrink-0" />
                Avisar a Bernardita por WhatsApp
              </a>

              {/* Secondary: go to tracker */}
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

  return (
    <div className="min-h-screen bg-stone-50 p-4 pb-8">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <header className="mb-6 pt-4">
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            <ArrowLeft className="size-4" />
            Volver a seleccion
          </button>
          <h1 className="text-balance text-2xl font-bold uppercase tracking-wide text-stone-800">
            Bordado / Matriz Digital
          </h1>
          <p className="mt-1 text-stone-500">Servicio de digitalizacion de bordados (.pes)</p>
        </header>

        {/* ── Step A: Mode ─────────────────────────────────────────────────── */}
        {step === "mode" && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">A</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Selecciona el Tipo de Servicio</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectMode("image")}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 bg-white p-6 transition-all hover:border-emerald-400",
                  mode === "image" ? "border-emerald-600 bg-emerald-50" : "border-stone-200"
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-xl bg-violet-100">
                  <ImageIcon className="size-7 text-violet-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-stone-800">Digitalizar Imagen</p>
                  <p className="mt-1 text-xs text-stone-500">Convertir logo o diseno a matriz</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectMode("text")}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 bg-white p-6 transition-all hover:border-emerald-400",
                  mode === "text" ? "border-emerald-600 bg-emerald-50" : "border-stone-200"
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-xl bg-blue-100">
                  <Type className="size-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-stone-800">Crear Texto</p>
                  <p className="mt-1 text-xs text-stone-500">Nombre, frase o iniciales</p>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* ── Step B: Size & auto-pricing ──────────────────────────────────── */}
        {step === "size" && mode && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">B</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Selecciona el Tamano</h2>
            </div>

            <div className="space-y-3">
              {SIZE_OPTIONS.map((option) => {
                const price         = mode === "image" ? option.imagePrice : option.textPrice
                const originalPrice = mode === "text" && option.id !== "10x10" ? option.imagePrice : null
                const hasDiscount   = originalPrice !== null

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectSize(option.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border-2 bg-white p-4 transition-all hover:border-emerald-400",
                      size === option.id ? "border-emerald-600 bg-emerald-50" : "border-stone-200"
                    )}
                  >
                    <div className="text-left">
                      <p className="font-bold text-stone-800">{option.label}</p>
                      <p className="text-sm text-stone-500">{option.dimensions}</p>
                    </div>
                    <div className="text-right">
                      {hasDiscount && (
                        <p className="text-sm text-stone-400 line-through">{formatCLP(originalPrice)}</p>
                      )}
                      <p className={cn("text-lg font-bold", hasDiscount ? "text-emerald-600" : "text-stone-800")}>
                        {formatCLP(price)}
                      </p>
                      {hasDiscount && (
                        <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">-20%</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setStep("mode")}
              className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700"
            >
              <ArrowLeft className="size-4" />
              Cambiar tipo de servicio
            </button>
          </section>
        )}

        {/* ── Step C: Inputs ───────────────────────────────────────────────── */}
        {step === "input" && mode && size && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">C</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">
                {mode === "image" ? "Sube tu Diseno" : "Ingresa tu Texto"}
              </h2>
            </div>

            {mode === "image" ? (
              <Card className="stitch-container mb-4 border-0 shadow-sm">
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">
                      Imagen del diseno + foto de referencia (opcional)
                    </Label>
                    <p className="mb-3 text-xs text-stone-500">
                      Puedes subir multiples imagenes: el diseno a digitalizar y una foto de la prenda destino
                    </p>

                    {designImages.length > 0 && (
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        {designImages.map((img, idx) => (
                          <div key={idx} className="relative overflow-hidden rounded-lg border-2 border-emerald-600">
                            <img src={img} alt={`Diseno ${idx + 1}`} className="aspect-square object-cover" />
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
                        <p className="font-medium text-stone-700">Toca para subir imagenes</p>
                        <p className="text-xs text-stone-500">PNG, JPG hasta 10MB</p>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="stitch-container mb-4 border-0 shadow-sm">
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="embroidery-text" className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">
                      Texto a bordar
                    </Label>
                    <Input
                      id="embroidery-text"
                      placeholder="Ej: Maria Gonzalez"
                      value={embroideryText}
                      onChange={(e) => setEmbroideryText(e.target.value)}
                      maxLength={selectedSize?.maxChars}
                      className="border-2 border-stone-200 bg-white focus:border-emerald-500"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-stone-500">{embroideryText.length} / {selectedSize?.maxChars} caracteres</span>
                      {embroideryText.length > (selectedSize?.maxChars || 0) * 0.8 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="size-3" />
                          Cerca del limite
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">Estilo de Fuente</Label>
                    <Select value={fontStyle || undefined} onValueChange={(val) => setFontStyle(val as FontStyle)}>
                      <SelectTrigger className="border-2 border-stone-200 bg-white">
                        <SelectValue placeholder="Selecciona un estilo" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((font) => (
                          <SelectItem key={font.id} value={font.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{font.label}</span>
                              <span className="text-xs text-stone-500">{font.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Limite de caracteres</p>
                        <p className="text-xs text-amber-700">
                          El tamano {selectedSize?.label} permite maximo {selectedSize?.maxChars} caracteres para legibilidad optima.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="stitch-container mb-4 border-0 shadow-sm">
              <CardContent className="pt-4">
                <Label htmlFor="additional-details" className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-800">
                  Detalles adicionales
                </Label>
                <Textarea
                  id="additional-details"
                  placeholder="Ej: Quiero el texto en color azul marino, ubicado en el bolsillo izquierdo..."
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  className="min-h-[100px] resize-none border-2 border-stone-200 bg-white focus:border-emerald-500"
                />
              </CardContent>
            </Card>

            {/* Price summary — driven entirely by Zustand */}
            <Card className="mb-4 border-2 border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-stone-600">Total a pagar</p>
                  <p className="text-sm text-stone-500">{selectedSize?.label} ({selectedSize?.dimensions})</p>
                </div>
                <div className="text-right">
                  {hasTextDiscount && (
                    <p className="text-sm text-stone-400 line-through">{formatCLP(originalTextPrice)}</p>
                  )}
                  <p className="text-2xl font-bold text-emerald-600">{formatCLP(calculatedPrice)}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("size")} className="flex-1 border-stone-300">
                <ArrowLeft className="mr-1 size-4" />
                Atras
              </Button>
              <Button
                onClick={() => setStep("schedule")}
                disabled={!canProceedFromInput}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Continuar
              </Button>
            </div>
          </section>
        )}

        {/* ── Step D: Schedule & payment ───────────────────────────────────── */}
        {step === "schedule" && mode && size && (
          <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">D</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Agenda tu Pedido</h2>
            </div>

            <Card className="stitch-container mb-4 overflow-hidden border-0 shadow-sm">
              <div className="bg-blue-500 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold">Entrega Digital</p>
                    <p className="text-sm text-blue-100">Archivo .pes por correo electronico</p>
                  </div>
                </div>
              </div>
              <CardContent className="bg-white p-4">
                <p className="text-sm text-stone-600">
                  El producto final es un archivo digital (.pes) que se enviara a tu correo electronico una vez completado el trabajo.
                </p>
              </CardContent>
            </Card>

            <Card className="stitch-container mb-4 border-0 shadow-sm">
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="scheduled-date" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-800">
                    <Calendar className="size-4" />
                    Fecha de Check-in (inicio produccion)
                  </Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border-2 border-stone-200 bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <Label htmlFor="scheduled-time" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-800">
                    <Clock className="size-4" />
                    Hora preferida
                  </Label>
                  <Select value={scheduledTime} onValueChange={setScheduledTime}>
                    <SelectTrigger className="border-2 border-stone-200 bg-white">
                      <SelectValue placeholder="Selecciona una hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Final price summary — driven by Zustand */}
            <Card className="mb-4 border-2 border-emerald-200 bg-emerald-50">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-stone-600">Servicio</span>
                  <span className="text-stone-800">{mode === "image" ? "Digitalizar Imagen" : "Crear Texto"}</span>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-stone-600">Tamano</span>
                  <span className="text-stone-800">{selectedSize?.label} ({selectedSize?.dimensions})</span>
                </div>
                {hasTextDiscount && (
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-emerald-600 text-sm font-medium">Descuento texto (−20%)</span>
                    <span className="text-emerald-600 text-sm font-medium">−{formatCLP(originalTextPrice - calculatedPrice)}</span>
                  </div>
                )}
                <div className="border-t border-emerald-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800">Total</span>
                    <span className="text-2xl font-bold text-emerald-600">{formatCLP(calculatedPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {createError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{createError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("input")} className="flex-1 border-stone-300" disabled={isCreatingOrder}>
                <ArrowLeft className="mr-1 size-4" />
                Atras
              </Button>
              <Button
                onClick={handleProceedToPayment}
                disabled={!canProceedFromSchedule || isCreatingOrder}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                {isCreatingOrder ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creando pedido...
                  </span>
                ) : (
                  "Pagar con Mercado Pago"
                )}
              </Button>
            </div>
          </section>
        )}
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onPaymentSuccess={handlePaymentSuccess}
        orderId={createdOrderId ?? undefined}
        orderSummary={{
          garmentType: "bordado",
          garmentTypeLabel: `Matriz Digital .pes - ${mode === "image" ? "Imagen" : "Texto"}`,
          description: `${selectedSize?.label} (${selectedSize?.dimensions})${mode === "text" ? ` - "${embroideryText}"` : ""}`,
          totalPrice: calculatedPrice,
        }}
      />
    </div>
  )
}
