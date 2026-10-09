/**
 * app/admin/kanban/page.tsx  →  /admin/kanban
 *
 * Pipeline de Producción — drag-and-drop Kanban board.
 * KanbanBoard manages its own internal D&D state; no store wiring needed yet.
 */

import { KanbanBoard } from "@/components/kanban-board"

export default function AdminKanbanPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Pipeline de Producción</h1>
        <p className="text-sm text-stone-500 mt-1">Arrastra las órdenes entre columnas para actualizar su estado</p>
      </div>
      <KanbanBoard />
    </div>
  )
}
