/**
 * app/api/payment/mp-preference/route.ts
 *
 * POST /api/payment/mp-preference — creates a real Mercado Pago Checkout
 * Pro preference for an existing order and returns its `init_point` so the
 * browser can redirect there.
 *
 * FIX (root cause): payment-modal.tsx used to just `setTimeout` for 2s and
 * call onPaymentSuccess with paymentStatus:"approved" — no real charge was
 * ever attempted, so every "Mercado Pago" order was actually free. This
 * route calls the real MP API instead.
 *
 * Requires MP_ACCESS_TOKEN (server-only) and NEXT_PUBLIC_APP_URL (for the
 * back_urls MP redirects to, and the notification_url it POSTs to).
 *
 * Flow:
 *  1. Client already created the order (POST /api/orders) and has orderId.
 *  2. This route re-reads that order server-side (never trusts a client-
 *     supplied amount) and creates a preference for its total_price.
 *  3. Client redirects window.location.href = init_point.
 *  4. MP redirects the customer back to /tracker?order_id=... afterwards.
 *  5. The actual payment confirmation arrives asynchronously at
 *     /api/payment/mp-webhook — that is the only place payment_status
 *     actually flips to "paid".
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    console.error("[POST /api/payment/mp-preference] Falta MP_ACCESS_TOKEN en el entorno")
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor (falta MP_ACCESS_TOKEN)" },
      { status: 500 }
    )
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { orderId } = body as { orderId?: string }

  if (!orderId) {
    return NextResponse.json({ error: "Falta orderId" }, { status: 400 })
  }

  // Re-read the order server-side — never trust an amount from the client.
  // RLS already restricts this select to the authenticated customer's own
  // orders (or an admin), so this also acts as an ownership check.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, garment_type, total_price, payment_status")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    console.error("[POST /api/payment/mp-preference] Pedido no encontrado:", orderError?.message)
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
  }

  if (!order.total_price || order.total_price <= 0) {
    return NextResponse.json({ error: "El pedido no tiene un monto válido" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  const GARMENT_LABELS: Record<string, string> = {
    pantalon: "Pantalón", short: "Short", blusa: "Blusa",
    polera: "Polera", poleron: "Polerón", otro: "Prenda", bordado: "Matriz de Bordado .pes",
  }

  const preferenceBody = {
    items: [
      {
        title: `Bordados Berny — ${GARMENT_LABELS[order.garment_type] ?? order.garment_type}`,
        quantity: 1,
        unit_price: order.total_price,
        currency_id: "CLP",
      },
    ],
    external_reference: order.id,
    back_urls: {
      success: `${appUrl}/tracker?order_id=${order.id}&mp_status=approved`,
      pending: `${appUrl}/tracker?order_id=${order.id}&mp_status=pending`,
      failure: `${appUrl}/tracker?order_id=${order.id}&mp_status=failure`,
    },
    auto_return: "approved",
    notification_url: `${appUrl}/api/payment/mp-webhook`,
    statement_descriptor: "BORDADOS BERNY",
  }

  try {
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error("[POST /api/payment/mp-preference] Mercado Pago rechazó la preferencia:", mpData)
      return NextResponse.json(
        { error: mpData?.message ?? "Mercado Pago rechazó la solicitud" },
        { status: 502 }
      )
    }

    // Record which gateway was chosen (payment_status stays "pending" until
    // the webhook confirms it — never set "paid" here).
    await supabase
      .from("orders")
      .update({ payment_provider: "mercadopago" })
      .eq("id", order.id)

    return NextResponse.json({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      preferenceId: mpData.id,
    })
  } catch (err) {
    console.error("[POST /api/payment/mp-preference] Excepción llamando a Mercado Pago:", err)
    return NextResponse.json({ error: "No se pudo conectar con Mercado Pago" }, { status: 502 })
  }
}
