"use client"

/**
 * app/wizard/page.tsx  →  /wizard
 *
 * Customer Intake Wizard (B2C).
 *
 * Key architectural changes vs. the original:
 *  - All meaningful state (garment, photos, description, embroidery) lives in
 *    Zustand (useAppStore) rather than local useState.
 *  - Local useState is still used for pure UI state that doesn't need to
 *    survive navigation (wizard step, isDragging, etc.).
 *  - Route guard: unauthenticated visitors are redirected to /.
 *  - On completion, order is committed to the store and user is pushed to /tracker.
 */

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Camera,
  X,
  ArrowLeft,
  Check,
  Shirt,
  Scissors,
  PenTool,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore, type GarmentType } from "@/store/useAppStore"
// EmbroideryWizard remains its own component; it writes to the store internally
import { EmbroideryWizard } from "@/components/embroidery-wizard"

// ─── Garment options (icon components kept verbatim) ──────────────────────────

function PantsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v2l-2 14h-4l-2-10-2 10H6L4 6V4z" />
    </svg>
  )
}
function ShortsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v2l-2 8h-4l-2-4-2 4H6L4 6V4z" />
    </svg>
  )
}
function TShirtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a1 1 0 001 1h10a1 1 0 001-1V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
    </svg>
  )
}
function HoodieIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a1 1 0 001 1h10a1 1 0 001-1V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
      <path d="M12 2v6" /><path d="M9 8h6" />
    </svg>
  )
}

interface GarmentOption {
  id: GarmentType
  label: string
  icon: React.ReactNode
}

const GARMENT_OPTIONS: GarmentOption[] = [
  { id: "pantalon", label: "Pantalón",      icon: <PantsIcon className="w-8 h-8" /> },
  { id: "short",    label: "Short",          icon: <ShortsIcon className="w-8 h-8" /> },
  { id: "blusa",    label: "Blusa",          icon: <Shirt className="w-8 h-8" /> },
  { id: "polera",   label: "Polera",         icon: <TShirtIcon className="w-8 h-8" /> },
  { id: "poleron",  label: "Polerón",        icon: <HoodieIcon className="w-8 h-8" /> },
  { id: "otro",     label: "Otro",           icon: <Scissors className="w-8 h-8" /> },
  { id: "bordado",  label: "Bordado/Matriz", icon: <PenTool className="w-8 h-8" /> },
]

// ─── Photo Dropzone (UI only, no store contact) ───────────────────────────────

interface PhotoDropzoneProps {
  label: string
  photo: string | null
  onUpload: (file: File) => void
  onRemove: () => void
}

function PhotoDropzone({ label, photo, onUpload, onRemove }: PhotoDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }, [])
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0])
  }, [onUpload])
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onUpload(e.target.files[0])
  }, [onUpload])

  if (photo) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-emerald-600 bg-white">
        <img src={photo} alt={label} className="w-full h-24 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white">{label}</span>
          <button onClick={onRemove} className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <label
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all",
        isDragging ? "border-emerald-600 bg-emerald-50" : "border-stone-300 bg-white hover:border-emerald-400"
      )}
    >
      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0", isDragging ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-400")}>
        <Camera className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-stone-700 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-stone-500 mt-0.5">Toca o arrastra una imagen</p>
      </div>
    </label>
  )
}

// ─── Wizard steps ──────────────────────────────────────────────────────────────

type WizardStep = "garment" | "photos" | "description" | "confirmation"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const router   = useRouter()
  const supabase = createClient()

  // ── Store selectors ──────────────────────────────────────────────────────────
  const order           = useAppStore((s) => s.order)
  const setGarmentType  = useAppStore((s) => s.setGarmentType)
  const setPhoto        = useAppStore((s) => s.setPhoto)
  const setDescription  = useAppStore((s) => s.setDescription)
  const resetOrder      = useAppStore((s) => s.resetOrder)

  // ── Route guard ──────────────────────────────────────────────────────────────
  // BUG FIX: this used to check the Zustand `userRole` flag, which is never
  // set anymore since login moved to real Supabase Auth (see app/page.tsx).
  // That stale value was always "unauthenticated", silently bouncing logged-in
  // customers back to "/". The middleware already guards this route server-side
  // with the real session cookie — this client check just needs the real user.
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        console.warn("[WizardPage] No hay sesión de Supabase — redirigiendo a /")
        router.replace("/")
      } else {
        setCheckingAuth(false)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local UI state (does not need to persist) ────────────────────────────────
  const [step, setStep] = useState<WizardStep>("garment")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const { garmentType, photos, description } = order
  const isBordado = garmentType === "bordado"

  // ── Photo handler: convert File → object URL, store it ──────────────────────
  // FIX (React error #310 — "Rendered more hooks than during the previous
  // render"): this useCallback used to sit AFTER the `if (checkingAuth) return`
  // below. On the first render (checkingAuth=true) React never reached this
  // hook; once auth resolved (checkingAuth=false) it did — a different hook
  // count between renders, which is exactly what error #310 means. All hooks
  // must run unconditionally on every render, so this now sits above every
  // conditional return in the component.
  const handlePhotoUpload = useCallback(
    (slot: "front" | "back" | "detail") => (file: File) => {
      const url = URL.createObjectURL(file)
      setPhoto(slot, url)
    },
    [setPhoto]
  )

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
      </div>
    )
  }

  // ── Completion ───────────────────────────────────────────────────────────────
  // Used as `onComplete` for EmbroideryWizard — that component already POSTs
  // its own order internally, so this is just a navigation callback.
  const handleGoToTracker = () => router.push("/tracker")

  // Real submission for plain-garment orders (pantalón, short, blusa, etc.)
  // FIX: this used to be a stub that only navigated — no insert ever happened.
  const handleSubmitOrder = async () => {
    setSubmitError(null)
    setIsSubmitting(true)

    const payload = { garmentType, photos, description, embroidery: null }
    console.log("[WizardPage] Enviando pedido →", payload)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error("[WizardPage] POST /api/orders falló:", { status: res.status, body: data })
        setSubmitError(data?.error ?? `Error ${res.status} al crear el pedido. Intenta de nuevo.`)
        setIsSubmitting(false)
        return
      }

      console.log("[WizardPage] Pedido creado con éxito. orderId:", data.orderId)
      setConfirmedOrderId(data.orderId)
      setIsSubmitting(false)

    } catch (err) {
      console.error("[WizardPage] Excepción al crear el pedido:", err)
      setSubmitError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.")
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    resetOrder()
    setConfirmedOrderId(null)
    setSubmitError(null)
    setStep("garment")
  }

  const buildWhatsAppUrl = () => {
    const label = GARMENT_OPTIONS.find(o => o.id === garmentType)?.label ?? garmentType
    const ref   = confirmedOrderId ? `#${confirmedOrderId.slice(0, 8).toUpperCase()}` : "(pendiente)"
    const msg   = `¡Hola Bernardita! Acabo de ingresar un nuevo ticket en la App. Mi número de pedido es ${ref} para un/a ${label}. ¡Quedo atenta/o a la confirmación!`
    return `https://wa.me/56951896142?text=${encodeURIComponent(msg)}`
  }

  // ── If bordado, hand off entirely to EmbroideryWizard ───────────────────────
  // EmbroideryWizard should be refactored to call useAppStore internally;
  // pass onBack/onComplete for navigation control.
  if (isBordado && step !== "garment") {
    return (
      <EmbroideryWizard
        onBack={() => setStep("garment")}
        onComplete={handleGoToTracker}
      />
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">

      {/* Stitch-styled top bar */}
      <div className="stitch-container sticky top-0 z-10 flex items-center gap-3 px-4 py-3 shadow-sm">
        {step !== "garment" && (
          <button
            onClick={() => setStep(step === "photos" ? "garment" : step === "description" ? "photos" : "description")}
            className="p-1 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Nueva Solicitud</p>
          <h1 className="text-sm font-bold text-stone-800">
            {step === "garment" && "¿Qué prenda necesitas?"}
            {step === "photos" && "Fotos de la prenda"}
            {step === "description" && "Cuéntanos más"}
            {step === "confirmation" && "Confirmación"}
          </h1>
        </div>
        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-1">
          {(["garment", "photos", "description", "confirmation"] as WizardStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                step === s ? "w-6 bg-emerald-600" :
                  (["garment","photos","description","confirmation"].indexOf(step) > i) ? "w-3 bg-emerald-400" : "w-3 bg-stone-300"
              )}
            />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── Step 1: Garment Selection ───────────────────────────────────── */}
        {step === "garment" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {GARMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setGarmentType(opt.id)           // ← Zustand
                    setStep(opt.id === "bordado" ? "photos" : "photos")
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                    garmentType === opt.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                  )}
                >
                  {opt.icon}
                  <span className="text-xs font-semibold text-center leading-tight">{opt.label}</span>
                  {garmentType === opt.id && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
              ))}
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
              disabled={!garmentType}
              onClick={() => setStep("photos")}
            >
              Continuar
            </Button>
          </>
        )}

        {/* ── Step 2: Photos ──────────────────────────────────────────────── */}
        {step === "photos" && (
          <>
            <p className="text-sm text-stone-500">
              Sube hasta 3 fotos para que podamos entender mejor tu solicitud.
            </p>
            <div className="space-y-3">
              <PhotoDropzone
                label="Vista Frontal"
                photo={photos.front}
                onUpload={handlePhotoUpload("front")}
                onRemove={() => setPhoto("front", null)}
              />
              <PhotoDropzone
                label="Vista Trasera"
                photo={photos.back}
                onUpload={handlePhotoUpload("back")}
                onRemove={() => setPhoto("back", null)}
              />
              <PhotoDropzone
                label="Detalle / Medida"
                photo={photos.detail}
                onUpload={handlePhotoUpload("detail")}
                onRemove={() => setPhoto("detail", null)}
              />
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
              onClick={() => setStep("description")}
            >
              {[photos.front, photos.back, photos.detail].some(Boolean)
                ? "Continuar"
                : "Continuar sin fotos"}
            </Button>
          </>
        )}

        {/* ── Step 3: Description ─────────────────────────────────────────── */}
        {step === "description" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-stone-700 font-semibold">
                Descripción del trabajo
              </Label>
              <Textarea
                id="desc"
                placeholder="Ej: Necesito arreglar el ruedo del pantalón, largo actual 32', largo deseado 30'. Tela delgada tipo dress pants..."
                className="min-h-32 border-stone-200 bg-white resize-none focus:border-emerald-500 focus:ring-emerald-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}  // ← Zustand
              />
              <p className="text-xs text-stone-400">{description.length} / 500 caracteres</p>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
              disabled={description.trim().length < 10}
              onClick={() => setStep("confirmation")}
            >
              Continuar
            </Button>
          </>
        )}

        {/* ── Step 4: Confirmation ────────────────────────────────────────── */}
        {step === "confirmation" && !confirmedOrderId && (
          <>
            <Card className="border-0 stitch-container shadow-md">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    {GARMENT_OPTIONS.find(o => o.id === garmentType)?.icon}
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 uppercase tracking-wide">Prenda</p>
                    <p className="font-semibold text-stone-800 capitalize">{garmentType}</p>
                  </div>
                </div>

                {[photos.front, photos.back, photos.detail].some(Boolean) && (
                  <div className="flex gap-2">
                    {([photos.front, photos.back, photos.detail] as (string | null)[])
                      .filter(Boolean)
                      .map((url, i) => (
                        <img key={i} src={url!} alt="" className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-100" />
                      ))}
                  </div>
                )}

                {description && (
                  <div>
                    <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Descripción</p>
                    <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3">{description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando...
                </span>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </Button>

            <button
              onClick={handleReset}
              disabled={isSubmitting}
              className="w-full mt-1 text-sm text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Comenzar de nuevo
            </button>
          </>
        )}

        {/* ── Success screen: real ticket number + WhatsApp contact ──────────── */}
        {step === "confirmation" && confirmedOrderId && (
          <Card className="border-0 stitch-container shadow-lg">
            <CardContent className="pb-8 pt-8 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-600">
                <Check className="size-8 text-white" />
              </div>
              <h2 className="mb-1 text-xl font-bold uppercase tracking-wide text-stone-800">
                Pedido Confirmado
              </h2>
              <p className="mb-4 font-mono text-xs tracking-widest text-stone-400">
                #{confirmedOrderId.slice(0, 8).toUpperCase()}
              </p>
              <p className="mb-6 text-sm text-stone-500">
                Bernardita revisará tu solicitud y te contactará para confirmar el presupuesto.
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href={buildWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] active:scale-95"
                >
                  Avisar a Bernardita por WhatsApp
                </a>
                <button
                  onClick={handleGoToTracker}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  Ver mi pedido
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
