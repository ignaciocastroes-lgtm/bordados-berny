export type OrderStatus =
  | "ticket_received"
  | "quote_pending"
  | "quote_approved"
  | "at_workshop"
  | "in_manufacturing"
  | "ready_pickup"

export interface TrackingStep {
  id: OrderStatus
  label: string
  description: string
}

export interface ShippingInfo {
  courier: string
  courierLogo: string
  trackingNumber: string
  status: string
  estimatedDelivery: Date
  deliveryAddress?: string
}

export interface TrackedOrder {
  id: string
  customerName: string
  garmentType: string
  garmentTypeLabel: string
  currentStatus: OrderStatus
  quotedPrice: number
  scheduledDate: Date
  completedAt?: Date
  finalPhotoUrl?: string
  deliveryOption?: "pickup" | "delivery"
  shippingInfo?: ShippingInfo
  statusHistory: {
    status: OrderStatus
    timestamp: Date
  }[]
}

export const TRACKING_STEPS: TrackingStep[] = [
  {
    id: "ticket_received",
    label: "Ticket Recibido",
    description: "Tu solicitud ha sido registrada",
  },
  {
    id: "quote_pending",
    label: "Presupuesto Listo",
    description: "Esperando pago para continuar",
  },
  {
    id: "quote_approved",
    label: "Pago Confirmado",
    description: "Tu pago ha sido procesado",
  },
  {
    id: "at_workshop",
    label: "Prendas en Taller",
    description: "Recibimos tu prenda",
  },
  {
    id: "in_manufacturing",
    label: "En Manufactura/Costura",
    description: "Trabajando en tu pedido",
  },
  {
    id: "ready_pickup",
    label: "Listo para Retiro!",
    description: "Tu prenda está lista",
  },
]

// Mock order with quote_pending status to trigger payment flow
export const MOCK_TRACKED_ORDER: TrackedOrder = {
  id: "ORD-2024-001",
  customerName: "Maria Gonzalez",
  garmentType: "pantalon",
  garmentTypeLabel: "Pantalon",
  currentStatus: "quote_pending",
  quotedPrice: 15000,
  scheduledDate: new Date(Date.now() + 3 * 86400000),
  statusHistory: [
    { status: "ticket_received", timestamp: new Date(Date.now() - 2 * 86400000) },
    { status: "quote_pending", timestamp: new Date(Date.now() - 1 * 86400000) },
  ],
}

// Mock order after payment for demonstration
export const MOCK_PAID_ORDER: TrackedOrder = {
  id: "ORD-2024-001",
  customerName: "Maria Gonzalez",
  garmentType: "pantalon",
  garmentTypeLabel: "Pantalon",
  currentStatus: "in_manufacturing",
  quotedPrice: 15000,
  scheduledDate: new Date(Date.now() + 3 * 86400000),
  deliveryOption: "delivery",
  shippingInfo: {
    courier: "BlueExpress",
    courierLogo: "BX",
    trackingNumber: "BB-987654321",
    status: "En ruta",
    estimatedDelivery: new Date(Date.now() + 2 * 86400000),
    deliveryAddress: "Av. Providencia 1234, Depto 56, Santiago",
  },
  statusHistory: [
    { status: "ticket_received", timestamp: new Date(Date.now() - 2 * 86400000) },
    { status: "quote_pending", timestamp: new Date(Date.now() - 1 * 86400000) },
    { status: "quote_approved", timestamp: new Date() },
    { status: "at_workshop", timestamp: new Date() },
    { status: "in_manufacturing", timestamp: new Date() },
  ],
}
