"use client"

import { useState } from "react"
import {
  Download,
  Printer,
  X,
  Package,
  MapPin,
  Phone,
  User,
  Store,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { KanbanJob } from "@/lib/kanban-types"

interface ShippingLabelModalProps {
  isOpen: boolean
  onClose: () => void
  job: KanbanJob | null
}

// Simulated barcode SVG component
function BarcodeGraphic() {
  const bars = [
    2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 1, 2, 3, 1, 2
  ]
  return (
    <div className="flex h-16 items-end justify-center gap-[1px]">
      {bars.map((width, i) => (
        <div
          key={i}
          className="bg-stone-900"
          style={{
            width: `${width * 2}px`,
            height: `${40 + (i % 3) * 8}px`,
          }}
        />
      ))}
    </div>
  )
}

// Simulated QR Code
function QRCodeGraphic() {
  return (
    <div className="grid size-20 grid-cols-8 gap-[2px] rounded bg-white p-1">
      {Array.from({ length: 64 }).map((_, i) => (
        <div
          key={i}
          className={`size-full ${
            // Create QR-like pattern with corners
            (i < 24 && i % 8 < 3) || // top-left
            (i < 24 && i % 8 > 4) || // top-right
            (i > 39 && i % 8 < 3) || // bottom-left
            Math.random() > 0.5
              ? "bg-stone-900"
              : "bg-white"
          }`}
        />
      ))}
    </div>
  )
}

export function ShippingLabelModal({
  isOpen,
  onClose,
  job,
}: ShippingLabelModalProps) {
  if (!job) return null

  // FIX (root cause): this used to show a hardcoded `mockAddress` for
  // every single order, regardless of what the customer actually chose
  // or typed at checkout — PaymentModal collected delivery_option /
  // delivery_address but nothing ever saved them. Now that payment-modal.tsx
  // persists both, this reads the real values.
  const isPickup = job.deliveryOption !== "delivery"
  const address = job.deliveryAddress?.trim()

  // Pickup orders ("Retiro en Taller") never needed a shipping label at
  // all — showing a fake courier label for a customer who is just walking
  // in was itself part of the "deuda" here. They get an honest pickup
  // confirmation instead.
  if (isPickup) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md border-0 bg-stone-50 p-0">
          <DialogHeader className="border-b border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Store className="size-5 text-emerald-600" />
                </div>
                <div>
                  <DialogTitle className="text-stone-800">Retiro en Taller</DialogTitle>
                  <p className="text-xs text-stone-500">Orden {job.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="size-5" />
              </button>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <p className="text-sm text-stone-600">
              <span className="font-semibold text-stone-800">{job.customerName}</span> elegió
              retirar este pedido directamente en el taller — no se genera etiqueta de envío.
            </p>
            <p className="text-xs text-stone-400">
              Avísale por WhatsApp cuando esté listo para retiro.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const trackingNumber = `BB-${job.id.slice(0, 8).toUpperCase()}`

  // Real print / "save as PDF" — browsers let the user pick "Guardar como
  // PDF" from the print destination list, so this is one honest action
  // instead of two (a real print, and a fake "Descargar PDF" that used to
  // just `alert()` and never produce a file).
  const handlePrint = () => window.print()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-0 bg-stone-50 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <Package className="size-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-stone-800">Etiqueta de Envio</DialogTitle>
                <p className="text-xs text-stone-500">Orden {job.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="size-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Shipping Label Preview */}
          <Card className="stitch-container overflow-hidden border-0 shadow-md">
            <CardContent className="bg-white p-0">
              {/* Label Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">Bordados Berny</p>
                    <p className="text-lg font-bold">Etiqueta de Despacho</p>
                  </div>
                  <div className="rounded bg-white p-1">
                    <QRCodeGraphic />
                  </div>
                </div>
              </div>

              {/* Label Body */}
              <div className="space-y-4 p-4">
                {/* Tracking Number */}
                <div className="rounded-lg bg-stone-50 p-3 text-center">
                  <p className="mb-1 text-xs text-stone-500">Numero de Seguimiento</p>
                  <p className="font-mono text-lg font-bold tracking-wider text-stone-800">{trackingNumber}</p>
                </div>

                {/* Barcode */}
                <div className="rounded-lg border border-stone-200 bg-white p-4">
                  <BarcodeGraphic />
                  <p className="mt-2 text-center font-mono text-xs text-stone-500">{trackingNumber}</p>
                </div>

                <Separator />

                {/* Recipient Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <User className="size-4 text-stone-500" />
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Destinatario</p>
                      <p className="font-semibold text-stone-800">{job.customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <MapPin className="size-4 text-stone-500" />
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Direccion</p>
                      <p className="text-sm text-stone-700">{address || "No especificada"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <Phone className="size-4 text-stone-500" />
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Telefono</p>
                      <p className="text-sm text-stone-700">{job.customerPhone || "No especificado"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="text-xs text-stone-500">Orden</p>
                    <p className="font-semibold text-stone-800">{job.id}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="text-xs text-stone-500">Prenda</p>
                    <p className="font-semibold text-stone-800">{job.garmentTypeLabel}</p>
                  </div>
                </div>

                {/* No courier is integrated yet — Bordados Berny coordinates
                    despacho by hand, so this says that honestly instead of
                    showing a courier/SLA that was never actually booked. */}
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700">Despacho manual</p>
                  <p className="text-xs text-amber-600">
                    Coordina el envío directamente con el cliente por WhatsApp — no hay
                    courier integrado todavía.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons — "Descargar PDF" opens the print dialog too;
              the browser's own "Guardar como PDF" destination produces a
              real file, instead of the old alert() that produced nothing. */}
          <div className="flex gap-3">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              <Download className="mr-2 size-4" />
              Guardar como PDF
            </Button>
            <Button
              onClick={handlePrint}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Printer className="mr-2 size-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
