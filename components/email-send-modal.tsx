"use client"

/**
 * components/email-send-modal.tsx
 *
 * FIX (root cause, part 1): this used to `setTimeout` for 2s and then
 * claim "Archivo Enviado!" — there is no email provider configured
 * anywhere in this app (no Resend/SendGrid key, nothing in .env.example),
 * so no email was ever actually sent. Worse, it was misleading: Bernardita
 * would see "sent successfully" and assume the customer had been notified.
 * Per Ignacio: notify over WhatsApp instead (the channel already used
 * everywhere else here), rather than adding an email provider for one
 * feature.
 *
 * FIX (root cause, part 2): there was nowhere to upload the finished
 * .pes/.dst file at all — it only ever traveled by hand, attached in the
 * WhatsApp chat. This now uploads it for real to the `design-uploads`
 * bucket and saves a signed URL on the order (`pes_file_url`), so the
 * customer can download it for themselves from /tracker. The WhatsApp
 * message still announces that it's ready — that part stays manual by
 * design (per Ignacio) — but the file itself no longer depends on it.
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  FileCode,
  MessageCircle,
  X,
  Download,
  Upload,
  ImageIcon,
  User,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { KanbanJob } from "@/lib/kanban-types"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface EmailSendModalProps {
  isOpen: boolean
  onClose: () => void
  job: KanbanJob | null
  /** Named onEmailSent for backward compat with kanban-board.tsx's prop,
   *  but it now fires once WhatsApp has been opened — see handlePesNotified
   *  in kanban-board.tsx. */
  onEmailSent?: (jobId: string) => void
}

export function EmailSendModal({
  isOpen,
  onClose,
  job,
  onEmailSent,
}: EmailSendModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Local override so the UI updates immediately after a successful
  // upload, without waiting for the Kanban board's realtime refetch.
  const [pesFileUrlOverride, setPesFileUrlOverride] = useState<string | null>(null)

  const handleClose = () => {
    setUploadError(null)
    onClose()
  }

  if (!job) return null

  const hasFile = pesFileUrlOverride ?? job.pesFileUrl

  // Real upload to the customer's own folder in `design-uploads` — same
  // bucket and path convention as completion-modal.tsx, so the existing
  // "storage: customer read own" policy already lets them fetch it too.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setIsUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop() || "pes"
      const path = `${job.customerId}/pes/${job.id}.${ext}`

      const { error: upErr } = await supabase.storage
        .from("design-uploads")
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: signed, error: signErr } = await supabase.storage
        .from("design-uploads")
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No se pudo generar el link del archivo")

      const res = await fetch(`/api/orders/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pes_file_url: signed.signedUrl }),
      })
      if (!res.ok) throw new Error("No se pudo guardar el archivo en el pedido")

      setPesFileUrlOverride(signed.signedUrl)
    } catch (err) {
      console.error("[EmailSendModal] Error subiendo el archivo .pes:", err)
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el archivo")
    } finally {
      setIsUploading(false)
    }
  }

  const buildWhatsAppUrl = () => {
    const phone = job.customerPhone?.replace(/\D/g, "")
    const msg = hasFile
      ? `Hola ${job.customerName}! Tu matriz de bordado digital (${job.garmentTypeLabel}) ` +
        `ya está lista. Puedes descargarla desde tu seguimiento de pedido en la app.`
      : `Hola ${job.customerName}! Tu matriz de bordado digital (${job.garmentTypeLabel}) ` +
        `ya está lista. Te adjunto el archivo .pes a continuación.`
    return phone
      ? `https://wa.me/56${phone.replace(/^56/, "")}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  const handleNotify = () => {
    window.open(buildWhatsAppUrl(), "_blank")
    onEmailSent?.(job.id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-0 bg-stone-50 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#25D366]">
                <MessageCircle className="size-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-stone-800">Archivo .pes</DialogTitle>
                <p className="text-xs text-stone-500">Checkout digital - {job.id}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="size-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Job Summary */}
          <Card className="stitch-container border-0 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-lg bg-violet-100">
                  <FileCode className="size-6 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-800">{job.garmentTypeLabel}</p>
                  <p className="text-sm text-stone-500">Archivo de matriz digital</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-stone-100 pt-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-stone-400" />
                  <span className="text-stone-600">Cliente:</span>
                  <span className="font-medium text-stone-800">{job.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-stone-400" />
                  <span className="text-stone-600">Fecha:</span>
                  <span className="font-medium text-stone-800">
                    {format(job.scheduledDate, "d MMM yyyy", { locale: es })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference image(s) the customer uploaded in the wizard — this
              used to not exist at all (they were thrown away client-side),
              so Bernardita was digitizing blind. */}
          {job.designImageUrls && job.designImageUrls.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-600">
                <ImageIcon className="size-3.5" /> Imagen de referencia del cliente
              </p>
              <div className="grid grid-cols-3 gap-2">
                {job.designImageUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-stone-200"
                  >
                    <img src={url} alt={`Referencia ${idx + 1}`} className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Real upload — replaces the old fake "file preview" card.
              Once uploaded, the signed URL is saved to orders.pes_file_url
              so the customer can download it themselves from /tracker. */}
          {hasFile ? (
            <Card className="overflow-hidden border-2 border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-14 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <CheckCircle2 className="size-7" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800">Archivo .pes subido</p>
                  <p className="text-sm text-emerald-600">Ya está disponible para el cliente en /tracker</p>
                </div>
                <a
                  href={hasFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  title="Ver archivo"
                >
                  <Download className="size-4" />
                </a>
              </CardContent>
            </Card>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 p-6 transition-all hover:border-violet-400">
              <input
                type="file"
                accept=".pes,.dst,.jef,.exp,.vp3"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <div className="flex size-12 items-center justify-center rounded-lg bg-violet-500 text-white">
                {isUploading ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Upload className="size-6" />
                )}
              </div>
              <div className="text-center">
                <p className="font-medium text-violet-800">
                  {isUploading ? "Subiendo…" : "Subir archivo .pes terminado"}
                </p>
                <p className="text-xs text-violet-500">.pes, .dst, .jef, .exp, .vp3</p>
              </div>
            </label>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
              <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{uploadError}</p>
            </div>
          )}

          {job.pesNotifiedAt && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <p className="text-xs text-emerald-700">
                Ya se notificó a este cliente el{" "}
                {format(new Date(job.pesNotifiedAt), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            </div>
          )}

          {/* Notify Button — disabled until the file is actually uploaded,
              so Bernardita can't notify "listo" before it's really ready. */}
          <Button
            onClick={handleNotify}
            disabled={!hasFile}
            className="h-14 w-full bg-[#25D366] text-lg font-semibold hover:bg-[#20bd5a] disabled:opacity-40"
            size="lg"
          >
            <MessageCircle className="mr-2 size-5" />
            Abrir WhatsApp y Notificar
          </Button>

          {/* Notice */}
          <p className="text-center text-xs text-stone-500">
            {hasFile
              ? "El cliente ya puede descargar el archivo desde /tracker — esto solo abre WhatsApp para avisarle"
              : "Sube el archivo .pes antes de notificar al cliente"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
