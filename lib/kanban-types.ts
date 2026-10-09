export type KanbanColumn =
  | "waiting_reception" 
  | "scheduled_today" 
  | "in_progress" 
  | "completed"

export interface KanbanJob {
  id: string
  customerId: string
  customerName: string
  customerPhone?: string | null
  garmentType: string
  garmentTypeLabel: string
  scheduledDate: Date
  totalPrice: number
  column: KanbanColumn
  isDigital?: boolean // For .pes matrix orders
  deliveryOption?: "pickup" | "delivery" | null
  deliveryAddress?: string | null
  completionPhotoUrl?: string | null
  pesNotifiedAt?: string | null
  designImageUrls?: string[] | null
  pesFileUrl?: string | null
}

export const COLUMN_CONFIG: Record<KanbanColumn, { title: string; color: string; bgColor: string }> = {
  waiting_reception: {
    title: "Esperando Recepción de Ropa",
    color: "bg-amber-500",
    bgColor: "bg-amber-50",
  },
  scheduled_today: {
    title: "Agenda Taller (Hoy)",
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
  },
  in_progress: {
    title: "En Ejecución",
    color: "bg-violet-500",
    bgColor: "bg-violet-50",
  },
  completed: {
    title: "Terminado (Subir Foto)",
    color: "bg-emerald-500",
    bgColor: "bg-emerald-50",
  },
}

export const GARMENT_ICONS: Record<string, string> = {
  pantalon: "👖",
  short: "🩳",
  blusa: "👚",
  polera: "👕",
  poleron: "🧥",
  otro: "✂️",
  bordado: "🧵",
}
