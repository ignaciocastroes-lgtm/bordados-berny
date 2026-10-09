/**
 * app/api/payment/mp-webhook/route.ts
 *
 * POST /api/payment/mp-webhook — Mercado Pago calls this URL by itself,
 * with no browser session, whenever a payment's status changes. This is
 * the ONLY place payment_status is ever set to "paid" — the client-side
 * success redirect (back_urls.success in mp-preference/route.ts) is just
 * a UX nicety and must never be trusted on its own, since a customer can
 * land on a "success" URL without actually having paid (closed tab,
 * flaky network, or a tampered redirect).
 *
 * MP sends either:
 *   POST /api/payment/mp-webhook?type=payment&data.id=123456
 *   POST /api/payment/mp-webhook  with body { type: "payment", data: { id } }
 * This route re-fetches the payment from MP's API directly (never trusts
 * the webhook body's own status field) and maps it onto the order found
 * via the payment's external_reference (the order id we set when creating
 * the preference).
 *
 * Uses the service-role client (lib/supabase/admin.ts) because there is no
 * logged-in user in this request for RLS to check against.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Mercado Pago payment status → our payment_status column
function mapMpStatus(mpStatus: string): "pending" | "paid" | "refunded" | "failed" | null {
  switch (mpStatus) {
    case "approved":              return "paid"
    case "refunded":
    case "charged_back":          return "refunded"
    case "rejected":
    case "cancelled":             return "failed"
    case "pending":
    case "in_process":
    case "in_mediation":          return "pending"
    default:                      return null
  }
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    console.error("[mp-webhook] Falta MP_ACCESS_TOKEN en el entorno")
    // Still 200 — MP retries on non-2xx, and this isn't MP's fault.
    return NextResponse.json({ received: true })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic")
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id")

  // Some MP event shapes only arrive in the JSON body.
  if (!paymentId) {
    const body = await request.json().catch(() => null)
    paymentId = body?.data?.id ?? body?.resource?.split("/").pop() ?? null
  }

  if (type !== "payment" && type !== "payment.updated" && type !== null) {
    // Merchant-order / other event types — nothing to do, acknowledge.
    return NextResponse.json({ received: true })
  }

  if (!paymentId) {
    console.warn("[mp-webhook] Notificación sin paymentId reconocible:", url.toString())
    return NextResponse.json({ received: true })
  }

  try {
    // Always re-fetch the payment from MP directly — never trust fields in
    // the webhook call itself, which is unauthenticated and could be spoofed.
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!mpRes.ok) {
      console.error("[mp-webhook] No se pudo leer el pago desde Mercado Pago:", mpRes.status)
      return NextResponse.json({ received: true })
    }

    const payment = await mpRes.json()
    const orderId = payment.external_reference as string | undefined
    const mappedStatus = mapMpStatus(payment.status as string)

    if (!orderId || !mappedStatus) {
      console.warn("[mp-webhook] Pago sin external_reference o estado no mapeable:", {
        paymentId, status: payment.status, orderId,
      })
      return NextResponse.json({ received: true })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: mappedStatus,
        payment_provider: "mercadopago",
      })
      .eq("id", orderId)

    if (error) {
      console.error("[mp-webhook] Falló el update en Supabase:", error.message)
    } else {
      console.log(`[mp-webhook] Pedido ${orderId} → payment_status=${mappedStatus} (MP payment ${paymentId}, status=${payment.status})`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[mp-webhook] Excepción procesando la notificación:", err)
    // Still ack with 200 so MP doesn't hammer retries on a transient error
    // on our side; the next webhook (or a manual reconciliation) will catch up.
    return NextResponse.json({ received: true })
  }
}
