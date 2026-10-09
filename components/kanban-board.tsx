"use client"

/**
 * components/kanban-board.tsx — Pipeline de Producción
 *
 * FIX (root cause): this used to render entirely from MOCK_KANBAN_JOBS,
 * so dragging a card between columns only ever updated in-memory React
 * state — nothing was ever persisted, and a page refresh (or Bernardita
 * opening the dashboard on another device) silently reset the whole
 * board back to the 10 fake jobs. There was no real "pipeline" at all.
 *
 * Now wired to Supabase:
 *  - Reads real `orders` rows (joined with `profiles` for the customer
 *    name), mapped into the existing `KanbanJob` shape so KanbanColumn /
 *    KanbanCard / the three modals need no prop changes.
 *  - Uses the new, purely additive `kanban_stage` column (see
 *    supabase-kanban-migration.sql) — this is a SEPARATE state machine
 *    from the customer-facing `orders.status` tracked in /tracker, so
 *    this never touches `status` or its RLS policy.
 *  - Persists drag-and-drop moves and "Finalizar" with a PATCH to
 *    /api/orders/:id (same endpoint command-center.tsx already uses),
 *    with an optimistic UI update and a revert-on-failure.
 *  - Supabase Realtime subscription + 30s polling fallback, matching
 *    command-center.tsx, so the board stays in sync across devices.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { createClient } from "@/lib/supabase/client"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { CompletionModal } from "./completion-modal"
import { ShippingLabelModal } from "./shipping-label-modal"
import { EmailSendModal } from "./email-send-modal"
import {
  type KanbanJob,
  type KanbanColumn as KanbanColumnType,
} from "@/lib/kanban-types"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

const COLUMNS: KanbanColumnType[] = [
  "waiting_reception",
  "scheduled_today",
  "in_progress",
  "completed",
]

const GARMENT_LABELS: Record<string, string> = {
  pantalon: "Pantalón", short: "Short", blusa: "Blusa",
  polera: "Polera", poleron: "Polerón", otro: "Otro", bordado: "Bordado",
}

// Raw shape returned by the Supabase query below.
interface OrderKanbanRow {
  id:                   string
  customer_id:          string
  garment_type:         string
  total_price:          number
  kanban_stage:         KanbanColumnType | null
  embroidery_mode:      string | null
  created_at:           string
  delivery_option:      "pickup" | "delivery" | null
  delivery_address:     string | null
  completion_photo_url: string | null
  pes_notified_at:      string | null
  design_image_urls:    string[] | null
  pes_file_url:         string | null
  profiles: { full_name: string | null; phone: string | null } | null
}

function mapOrderToJob(row: OrderKanbanRow): KanbanJob {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.profiles?.full_name ?? "Cliente",
    customerPhone: row.profiles?.phone ?? null,
    garmentType: row.garment_type,
    garmentTypeLabel: GARMENT_LABELS[row.garment_type] ?? row.garment_type,
    // `scheduledDate` has no real workshop-scheduling input yet — using
    // created_at keeps the card informative (and sortable) without
    // inventing a date the data model doesn't have.
    scheduledDate: new Date(row.created_at),
    totalPrice: row.total_price,
    column: row.kanban_stage ?? "waiting_reception",
    // Digital (.pes matrix) orders use the embroidery flow instead of a
    // physical-garment flow, so they get the email-delivery action in
    // KanbanCard instead of a shipping label.
    isDigital: row.embroidery_mode != null,
    deliveryOption: row.delivery_option,
    deliveryAddress: row.delivery_address,
    completionPhotoUrl: row.completion_photo_url,
    pesNotifiedAt: row.pes_notified_at,
    designImageUrls: row.design_image_urls,
    pesFileUrl: row.pes_file_url,
  }
}

export function KanbanBoard() {
  const supabase = createClient()

  const [jobs, setJobs] = useState<KanbanJob[]>([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState<KanbanJob | null>(null)
  const [completionJob, setCompletionJob] = useState<KanbanJob | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [labelJob, setLabelJob] = useState<KanbanJob | null>(null)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [emailJob, setEmailJob] = useState<KanbanJob | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ── Query ──────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, customer_id, garment_type, total_price, kanban_stage,
        embroidery_mode, created_at,
        delivery_option, delivery_address, completion_photo_url, pes_notified_at,
        design_image_urls, pes_file_url,
        profiles ( full_name, phone )
      `)
      .order("created_at", { ascending: false })
      .returns<OrderKanbanRow[]>()

    if (!error && data) {
      setJobs(data.map(mapOrderToJob))
    }

    setLoading(false)
  }, []) // eslint-disable-line

  // ── Realtime ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJobs()

    const channel = supabase
      .channel("orders-kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchJobs(true)
      )
      .subscribe()

    pollingRef.current = setInterval(() => fetchJobs(true), 30_000)

    return () => {
      supabase.removeChannel(channel)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, []) // eslint-disable-line

  const getJobsByColumn = useCallback(
    (column: KanbanColumnType) => jobs.filter((job) => job.column === column),
    [jobs]
  )

  // ── Persist a column move ────────────────────────────────────────────────
  const persistStage = async (jobId: string, stage: KanbanColumnType) => {
    try {
      const res = await fetch(`/api/orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanban_stage: stage }),
      })
      if (!res.ok) throw new Error("PATCH failed")
    } catch {
      toast.error("No se pudo guardar el cambio, reintentando…")
      fetchJobs(true)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const job = jobs.find((j) => j.id === active.id)
    if (job) {
      setActiveJob(job)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveJob(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeJob = jobs.find((j) => j.id === activeId)
    if (!activeJob) return

    let targetColumn: KanbanColumnType | undefined

    if (COLUMNS.includes(overId as KanbanColumnType)) {
      targetColumn = overId as KanbanColumnType
    } else {
      const overJob = jobs.find((j) => j.id === overId)
      if (overJob) {
        targetColumn = overJob.column
      }
    }

    if (!targetColumn || activeJob.column === targetColumn) return

    if (targetColumn === "completed") {
      setCompletionJob(activeJob)
      setShowCompletionModal(true)
      return
    }

    // Optimistic UI, then persist.
    setJobs((prev) =>
      prev.map((job) =>
        job.id === activeId ? { ...job, column: targetColumn! } : job
      )
    )
    persistStage(activeId, targetColumn)

    toast.success(`${activeJob.customerName} movido a nueva columna`)
  }

  // `photoUrl` is now a real signed Supabase Storage URL — CompletionModal
  // uploads the file itself before calling this (see completion-modal.tsx).
  const handleCompletion = async (jobId: string, photoUrl: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, column: "completed", completionPhotoUrl: photoUrl } : job
      )
    )
    try {
      const res = await fetch(`/api/orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanban_stage: "completed", completion_photo_url: photoUrl }),
      })
      if (!res.ok) throw new Error("PATCH failed")
    } catch {
      toast.error("No se pudo guardar la foto de finalización, reintentando…")
      fetchJobs(true)
    }
    toast.success("Trabajo finalizado", {
      description: "Avisa al cliente por WhatsApp que su pedido está listo para retiro.",
    })
  }

  const handleGenerateLabel = (job: KanbanJob) => {
    setLabelJob(job)
    setShowLabelModal(true)
  }

  const handleSendEmail = (job: KanbanJob) => {
    setEmailJob(job)
    setShowEmailModal(true)
  }

  // FIX (root cause): this used to `setTimeout` for 2s and claim "Archivo
  // enviado exitosamente" — no email provider is configured anywhere in
  // this app, so nothing was ever actually sent, and Bernardita would
  // believe the customer had been notified when they hadn't. EmailSendModal
  // now notifies over WhatsApp instead (the channel already used
  // everywhere else here) and this just records that it happened.
  const handlePesNotified = async (jobId: string) => {
    const now = new Date().toISOString()
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, pesNotifiedAt: now } : job))
    )
    try {
      const res = await fetch(`/api/orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pes_notified_at: now }),
      })
      if (!res.ok) throw new Error("PATCH failed")
    } catch {
      fetchJobs(true)
    }
    toast.success("Cliente notificado por WhatsApp", {
      description: "Recuerda adjuntar el archivo .pes manualmente en la conversación.",
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">
            Pipeline de Producción
          </h2>
          <p className="text-sm text-muted-foreground">
            Arrastra los trabajos entre columnas para actualizar su estado
          </p>
        </div>
        {loading && <RefreshCw className="size-5 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column}
                column={column}
                jobs={getJobsByColumn(column)}
                onGenerateLabel={handleGenerateLabel}
                onSendEmail={handleSendEmail}
              />
            ))}
          </div>

          <DragOverlay>
            {activeJob ? <KanbanCard job={activeJob} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CompletionModal
        open={showCompletionModal}
        onOpenChange={setShowCompletionModal}
        job={completionJob}
        onComplete={handleCompletion}
      />

      <ShippingLabelModal
        isOpen={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        job={labelJob}
      />

      <EmailSendModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        job={emailJob}
        onEmailSent={handlePesNotified}
      />
    </div>
  )
}
