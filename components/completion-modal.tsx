"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, Upload, X, CheckCircle2, Send, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { KanbanJob } from "@/lib/kanban-types"
import { GARMENT_ICONS } from "@/lib/kanban-types"

interface CompletionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: KanbanJob | null
  onComplete: (jobId: string, photoUrl: string) => void
}

export function CompletionModal({
  open,
  onOpenChange,
  job,
  onComplete,
}: CompletionModalProps) {
  // `photo` is just the preview (data URL); `file` is the real Blob we
  // actually upload — FIX (root cause): this used to only ever keep the
  // base64 preview in React state and hand IT to onComplete, so the photo
  // was never actually stored anywhere — it vanished the moment anyone
  // refreshed the page or opened the board on another device.
  const [photo, setPhoto] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPhoto(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }, [loadFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }, [loadFile])

  // Real upload to the `design-uploads` bucket, under the CUSTOMER's own
  // folder — `{customerId}/completado/...` — so the existing "storage:
  // customer read own" policy lets them see it too, not just the admin
  // policy. The bucket is private, so we hand back a signed URL rather
  // than a public one.
  const handleComplete = async () => {
    if (!job || !file) return

    setUploadError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${job.customerId}/completado/${job.id}-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("design-uploads")
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadErr) throw uploadErr

      // Signed for ~1 year — long enough for a finished-garment photo to
      // stay visible in /tracker without re-signing on every read. There's
      // no automatic renewal, so a job that sits untouched past that
      // window would need a fresh signed URL (Round 4 territory if this
      // becomes an issue in practice).
      const { data: signed, error: signErr } = await supabase.storage
        .from("design-uploads")
        .createSignedUrl(path, 60 * 60 * 24 * 365)

      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No se pudo generar el link de la foto")

      onComplete(job.id, signed.signedUrl)
      setPhoto(null)
      setFile(null)
      onOpenChange(false)
    } catch (err) {
      console.error("[CompletionModal] Error subiendo la foto:", err)
      setUploadError(
        err instanceof Error ? err.message : "No se pudo subir la foto. Intenta de nuevo."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setPhoto(null)
    setFile(null)
    setUploadError(null)
    onOpenChange(false)
  }

  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-500" />
            Finalizar Trabajo
          </DialogTitle>
          <DialogDescription>
            Sube una foto del resultado final para notificar al cliente
          </DialogDescription>
        </DialogHeader>

        <Card className="border-border bg-muted/30 p-4">
          <div className="flex items-center gap-4">
            <span className="text-3xl">
              {GARMENT_ICONS[job.garmentType] || "✂️"}
            </span>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{job.customerName}</h4>
              <p className="text-sm text-muted-foreground">{job.garmentTypeLabel}</p>
            </div>
            <Badge variant="secondary" className="font-semibold">
              ${job.totalPrice.toLocaleString("es-CL")}
            </Badge>
          </div>
        </Card>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Foto del resultado final
          </label>
          
          {photo ? (
            <div className="relative overflow-hidden rounded-lg border border-border">
              <img
                src={photo}
                alt="Resultado final"
                className="aspect-[4/3] w-full object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2 size-8"
                onClick={() => setPhoto(null)}
              >
                <X />
              </Button>
            </div>
          ) : (
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-all",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Camera className="size-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Arrastra una foto o haz clic para subir
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  JPG, PNG hasta 10MB
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{uploadError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleComplete}
            disabled={!file || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Subiendo...
              </>
            ) : (
              <>
                <Send data-icon="inline-start" />
                Finalizar y Notificar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
