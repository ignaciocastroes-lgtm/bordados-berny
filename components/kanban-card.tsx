"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, DollarSign, GripVertical, Tag, MessageCircle, Mail, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KanbanJob } from "@/lib/kanban-types"
import { GARMENT_ICONS } from "@/lib/kanban-types"

interface KanbanCardProps {
  job: KanbanJob
  isDragging?: boolean
  onGenerateLabel?: (job: KanbanJob) => void
  onSendEmail?: (job: KanbanJob) => void
}

// FIX (root cause): both WhatsApp buttons below used to be hardcoded to
// "56912345678" — a placeholder number — for every single customer, so
// clicking them always opened a chat with the same fake number instead of
// the actual customer. Now builds a real wa.me link from job.customerPhone,
// matching the same pattern already used in command-center.tsx.
function buildCustomerWhatsAppUrl(job: KanbanJob, message: string) {
  const phone = job.customerPhone?.replace(/\D/g, "")
  return phone
    ? `https://wa.me/56${phone.replace(/^56/, "")}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function KanbanCard({ job, isDragging, onGenerateLabel, onSendEmail }: KanbanCardProps) {
  const isCompleted = job.column === "completed"
  const isDigital = job.isDigital === true
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragging = isDragging || isSortableDragging

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-grab border-border bg-card p-4 transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md",
        dragging && "rotate-2 scale-105 cursor-grabbing border-primary shadow-xl ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <GripVertical className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-lg" aria-hidden="true">
              {GARMENT_ICONS[job.garmentType] || "✂️"}
            </span>
            <div className="flex items-center gap-1">
              {isDigital && (
                <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                  <FileCode className="mr-1 size-3" />
                  .pes
                </Badge>
              )}
              <Badge variant="outline" className="shrink-0 text-xs font-medium">
                {job.id}
              </Badge>
            </div>
          </div>

          <h4 className="mb-1 truncate font-semibold text-foreground">
            {job.customerName}
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {job.garmentTypeLabel}
          </p>

          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>{format(job.scheduledDate, "d MMM yyyy", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <DollarSign className="size-3.5" />
              <span>${job.totalPrice.toLocaleString("es-CL")} CLP</span>
            </div>
          </div>

          {/* Action buttons for completed jobs */}
          {isCompleted && (
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              {isDigital ? (
                /* Digital order: Email send button instead of shipping label */
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSendEmail?.(job)
                    }}
                  >
                    <Mail className="mr-1 size-3" />
                    Enviar Archivo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(buildCustomerWhatsAppUrl(job, `Hola ${job.customerName}! Tu archivo de bordado ${job.id} está listo.`), "_blank")
                    }}
                  >
                    <MessageCircle className="size-4" />
                  </Button>
                </>
              ) : (
                /* Physical order: Shipping label button */
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onGenerateLabel?.(job)
                    }}
                  >
                    <Tag className="mr-1 size-3" />
                    Generar Etiqueta
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(buildCustomerWhatsAppUrl(job, `Hola ${job.customerName}! Tu prenda ${job.id} está lista para retiro.`), "_blank")
                    }}
                  >
                    <MessageCircle className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
