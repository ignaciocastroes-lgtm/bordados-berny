"use client"

import { useState } from "react"
import {
  CreditCard,
  Landmark,
  Check,
  Shield,
  X,
  Store,
  Truck,
  MapPin,
  Copy,
  CheckCheck,
  AlertCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Top-level payment gateway: Mercado Pago (card/online) or Manual Transfer.
 * Replaces the original flat list of credit/debit/transfer options.
 */
export type PaymentGateway = "mercadopago" | "transfer"

/**
 * Passed back to the wizard so it can:
 *  1. Build the correct WhatsApp message
 *  2. Send the right payment_method to Supabase
 *
 * paymentStatus is always "pending" here — it's a customer-initiated
 * status, and a customer is never allowed to mark their own order "paid"
 * (see app/api/orders/[id]/route.ts). Transfer stays "pending" until
 * Bernardita validates it by hand; Mercado Pago's real confirmation
 * arrives separately via the webhook, so onPaymentSuccess is never even
 * called for that gateway (the browser navigates to MP's checkout instead).
 */
export interface PaymentResult {
  orderId?: string
  paymentMethod: PaymentGateway
  paymentStatus: "pending"
  deliveryOption: "pickup" | "delivery"
  deliveryAddress: string
}

interface OrderSummary {
  garmentType: string
  garmentTypeLabel: string
  description: string
  totalPrice: number
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  /** Receives full PaymentResult so wizard can branch WhatsApp message */
  onPaymentSuccess: (result: PaymentResult) => void
  orderSummary: OrderSummary
  /**
   * The order row already created in Supabase before this modal opened
   * (see embroidery-wizard.tsx handleProceedToPayment). Required to charge
   * via Mercado Pago — the preference is built server-side from this
   * order's real total_price, never from orderSummary.totalPrice alone,
   * so the amount charged can't be tampered with client-side.
   */
  orderId?: string
}

// ─── Bank data placeholder ────────────────────────────────────────────────────
// Replace with real account data before going live.
const BANK_DATA = {
  banco:    "Banco Estado",
  tipo:     "Cuenta Corriente",
  numero:   "123-456789-01",
  rut:      "76.XXX.XXX-X",
  nombre:   "Bordados Berny SpA",
  email:    "pagos@bordadosberny.cl",
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 shrink-0 text-stone-400 transition-colors hover:text-emerald-600"
      title="Copiar"
    >
      {copied
        ? <CheckCheck className="size-4 text-emerald-500" />
        : <Copy className="size-4" />
      }
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  orderSummary,
  orderId,
}: PaymentModalProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [gateway,         setGateway]        = useState<PaymentGateway | null>(null)
  const [deliveryOption,  setDeliveryOption] = useState<"pickup" | "delivery">("pickup")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [isProcessing,    setIsProcessing]   = useState(false)
  const [mpError,         setMpError]        = useState<string | null>(null)

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleClose = () => {
    if (isProcessing) return
    setGateway(null)
    setDeliveryOption("pickup")
    setDeliveryAddress("")
    onClose()
  }

  // ── Mercado Pago ────────────────────────────────────────────────────────────
  /**
   * FIX (root cause): this used to `setTimeout` for 2s and call
   * onPaymentSuccess with paymentStatus:"approved" unconditionally — no
   * real charge was ever attempted, so every "Mercado Pago" order was
   * actually free and nothing was ever verified.
   *
   * Real flow:
   *  1. POST /api/payment/mp-preference with this order's id.
   *  2. Server re-reads the order's real total_price and creates a real
   *     Checkout Pro preference, returns { init_point }.
   *  3. Redirect the whole page there — MP needs to own the tab for its
   *     own checkout UI (card entry, 3DS, etc).
   *  4. MP later calls /api/payment/mp-webhook on its own; THAT is what
   *     actually flips payment_status to "paid" in Supabase.
   *  5. MP's back_urls bring the customer back to /tracker afterwards —
   *     onPaymentSuccess below is never called for Mercado Pago, since
   *     the browser navigates away before there's anything to call back.
   */
  const handleMercadoPago = async () => {
    if (!orderId) {
      setMpError("No se encontró el pedido. Vuelve atrás e inténtalo de nuevo.")
      return
    }
    setMpError(null)
    setIsProcessing(true)
    try {
      // Save the delivery choice before leaving the page — onPaymentSuccess
      // is never called for Mercado Pago (see comment above), so this is
      // the only chance to persist it for this gateway.
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_option: deliveryOption,
          delivery_address: deliveryOption === "delivery" ? deliveryAddress : "",
        }),
      }).catch(() => { /* non-fatal — the order can still be paid without this */ })

      const res = await fetch("/api/payment/mp-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) {
        throw new Error(data?.error ?? "Mercado Pago no devolvió un link de pago")
      }
      window.location.href = data.init_point
      // No setIsProcessing(false) here on purpose — the page is navigating away.
    } catch (err) {
      console.error("[PaymentModal] Error creando preferencia de Mercado Pago:", err)
      setMpError(
        err instanceof Error ? err.message : "No se pudo conectar con Mercado Pago"
      )
      setIsProcessing(false)
    }
  }

  // ── Manual Transfer ─────────────────────────────────────────────────────────
  const handleTransferConfirm = () => {
    // payment_status = 'pending' — Bernardita validates manually
    onPaymentSuccess({
      paymentMethod: "transfer",
      paymentStatus: "pending",
      deliveryOption,
      deliveryAddress: deliveryOption === "delivery" ? deliveryAddress : "",
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-0 bg-stone-50 p-0 sm:max-w-lg">

        {/* Header */}
        <DialogHeader className="border-b border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500">
                <CreditCard className="size-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-stone-800">Checkout</DialogTitle>
                <p className="text-xs text-stone-500">Elige tu método de pago</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-4">

          {/* Order Summary */}
          <Card className="stitch-container border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Resumen del Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-xl">
                  {orderSummary.garmentType === "pantalon" && "👖"}
                  {orderSummary.garmentType === "short"    && "🩳"}
                  {orderSummary.garmentType === "blusa"    && "👚"}
                  {orderSummary.garmentType === "polera"   && "👕"}
                  {orderSummary.garmentType === "poleron"  && "🧥"}
                  {orderSummary.garmentType === "otro"     && "✂️"}
                  {orderSummary.garmentType === "bordado"  && "🧵"}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-stone-800">{orderSummary.garmentTypeLabel}</p>
                  <p className="text-sm text-stone-500">{orderSummary.description}</p>
                </div>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800">Total a Pagar</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {formatCLP(orderSummary.totalPrice)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Options (preserved from original) */}
          <Card className="stitch-container border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Método de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3">
                {(["pickup", "delivery"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDeliveryOption(opt)}
                    disabled={isProcessing}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                      deliveryOption === opt
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-stone-200 bg-white hover:border-emerald-300",
                      isProcessing && "opacity-50"
                    )}
                  >
                    {opt === "pickup"
                      ? <Store className={cn("size-6", deliveryOption === opt ? "text-emerald-600" : "text-stone-400")} />
                      : <Truck className={cn("size-6", deliveryOption === opt ? "text-emerald-600" : "text-stone-400")} />
                    }
                    <span className={cn(
                      "text-sm font-medium",
                      deliveryOption === opt ? "text-emerald-700" : "text-stone-600"
                    )}>
                      {opt === "pickup" ? "Retiro en Taller" : "Despacho a Domicilio"}
                    </span>
                  </button>
                ))}
              </div>
              {deliveryOption === "delivery" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="address" className="text-xs font-medium text-stone-600">
                    <MapPin className="mr-1 inline-block size-3" />
                    Dirección de Entrega
                  </Label>
                  <Input
                    id="address"
                    placeholder="Ej: Av. Providencia 1234, Depto 56"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="border-stone-200 bg-white focus:border-emerald-500"
                    disabled={isProcessing}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── GATEWAY SELECTION ──────────────────────────────────────────── */}
          <Card className="stitch-container border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Método de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">

              {/* Option A: Mercado Pago */}
              <button
                onClick={() => setGateway("mercadopago")}
                disabled={isProcessing}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-all",
                  gateway === "mercadopago"
                    ? "border-[#009EE3] bg-blue-50"
                    : "border-stone-200 bg-white hover:border-[#009EE3]/60",
                  isProcessing && "opacity-50"
                )}
              >
                {/* MP logo badge */}
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#009EE3]">
                  <CreditCard className="size-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-semibold",
                    gateway === "mercadopago" ? "text-[#009EE3]" : "text-stone-800"
                  )}>
                    Pagar con Mercado Pago
                  </p>
                  <p className="text-xs text-stone-500">
                    Tarjeta débito / crédito · hasta 12 cuotas sin interés
                  </p>
                </div>
                <div className={cn(
                  "flex size-5 items-center justify-center rounded-full border-2 shrink-0",
                  gateway === "mercadopago" ? "border-[#009EE3] bg-[#009EE3]" : "border-stone-300"
                )}>
                  {gateway === "mercadopago" && <Check className="size-3 text-white" />}
                </div>
              </button>

              {/* Option B: Manual Transfer */}
              <button
                onClick={() => setGateway("transfer")}
                disabled={isProcessing}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-all",
                  gateway === "transfer"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-stone-200 bg-white hover:border-emerald-400",
                  isProcessing && "opacity-50"
                )}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                  <Landmark className="size-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-semibold",
                    gateway === "transfer" ? "text-emerald-700" : "text-stone-800"
                  )}>
                    Transferencia Bancaria
                  </p>
                  <p className="text-xs text-stone-500">
                    Redbanc · MACH · Cuenta RUT · Fintoc
                  </p>
                </div>
                <div className={cn(
                  "flex size-5 items-center justify-center rounded-full border-2 shrink-0",
                  gateway === "transfer" ? "border-emerald-500 bg-emerald-500" : "border-stone-300"
                )}>
                  {gateway === "transfer" && <Check className="size-3 text-white" />}
                </div>
              </button>

              {/* ── Bank data panel (expands when transfer selected) ────────── */}
              {gateway === "transfer" && (
                <div className="rounded-xl border-2 border-emerald-200 bg-white p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">

                  <div className="flex items-center gap-2 mb-1">
                    <Landmark className="size-4 text-emerald-600" />
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Datos de Transferencia
                    </p>
                  </div>

                  {/* Bank data rows */}
                  {[
                    { label: "Banco",   value: BANK_DATA.banco  },
                    { label: "Tipo",    value: BANK_DATA.tipo   },
                    { label: "N° Cta",  value: BANK_DATA.numero },
                    { label: "RUT",     value: BANK_DATA.rut    },
                    { label: "Nombre",  value: BANK_DATA.nombre },
                    { label: "Email",   value: BANK_DATA.email  },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-stone-500 w-16 shrink-0">{label}</span>
                      <span className="font-mono font-medium text-stone-800 flex-1 text-right">
                        {value}
                      </span>
                      <CopyButton text={value} />
                    </div>
                  ))}

                  {/* Amount to transfer */}
                  <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-700">Monto exacto</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-emerald-700">
                        {formatCLP(orderSummary.totalPrice)}
                      </span>
                      <CopyButton text={String(orderSummary.totalPrice)} />
                    </div>
                  </div>

                  {/* Notice */}
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
                    <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Envía el comprobante por WhatsApp al confirmar. Tu pedido queda
                      agendado una vez que Bernardita valide el pago.
                    </p>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
            <Shield className="size-4" />
            <span>Pago 100% seguro</span>
          </div>

          {/* ── Mercado Pago error (preference creation failed) ─────────── */}
          {mpError && gateway === "mercadopago" && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
              <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{mpError}</p>
            </div>
          )}

          {/* ── CTA button — changes label by gateway ────────────────────── */}
          {gateway === "mercadopago" && (
            <Button
              onClick={handleMercadoPago}
              disabled={isProcessing}
              className="h-14 w-full bg-[#009EE3] text-base font-semibold hover:bg-[#0085c3] disabled:opacity-50"
              size="lg"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Conectando con Mercado Pago...
                </span>
              ) : (
                <>
                  <CreditCard className="mr-2 size-5" />
                  Pagar con Mercado Pago
                </>
              )}
            </Button>
          )}

          {gateway === "transfer" && (
            <Button
              onClick={handleTransferConfirm}
              disabled={isProcessing}
              className="h-14 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
              size="lg"
            >
              <Check className="mr-2 size-5" />
              Ya transferí, finalizar pedido
            </Button>
          )}

          {!gateway && (
            <Button disabled className="h-14 w-full opacity-40" size="lg">
              Selecciona un método de pago
            </Button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
