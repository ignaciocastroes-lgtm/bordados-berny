"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { KanbanCard } from "./kanban-card"
import type { KanbanJob, KanbanColumn as KanbanColumnType } from "@/lib/kanban-types"
import { COLUMN_CONFIG } from "@/lib/kanban-types"
import { ScrollArea } from "@/components/ui/scroll-area"

interface KanbanColumnProps {
  column: KanbanColumnType
  jobs: KanbanJob[]
  onGenerateLabel?: (job: KanbanJob) => void
  onSendEmail?: (job: KanbanJob) => void
}

export function KanbanColumn({ column, jobs, onGenerateLabel, onSendEmail }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
  })

  const config = COLUMN_CONFIG[column]
  const jobIds = jobs.map((job) => job.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-w-[300px] flex-col rounded-xl border border-border bg-muted/30 transition-all duration-200",
        isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className={cn("size-3 rounded-full", config.color)} />
        <h3 className="flex-1 text-sm font-semibold uppercase tracking-wide text-foreground">
          {config.title}
        </h3>
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {jobs.length}
        </span>
      </div>

      <ScrollArea className="flex-1 p-3">
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 text-3xl opacity-30">📭</div>
                <p className="text-sm text-muted-foreground">Sin trabajos</p>
              </div>
            ) : (
              jobs.map((job) => <KanbanCard key={job.id} job={job} onGenerateLabel={onGenerateLabel} onSendEmail={onSendEmail} />)
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}
