/**
 * app/api/orders/[id]/route.ts
 *
 * PATCH /api/orders/:id — order mutation, admin OR the order's own customer.
 *
 * FIX (root cause): this route used to be admin-only (403 for anyone whose
 * profiles.role !== 'admin'), but embroidery-wizard.tsx's
 * handlePaymentSuccess() — running as the CUSTOMER right after they pay —
 * has always called this same endpoint to record payment_provider /
 * payment_status. Every customer PATCH after checkout was silently 403'd
 * (swallowed by a try/catch that only logged to the console), so no order
 * ever actually got its post-payment fields saved. This split the allowed
 * fields in two instead of just opening the whole route to customers:
 *
 *  - Admin: everything (unchanged behavior).
 *  - The order's own customer: only payment_provider, delivery_option,
 *    delivery_address — plus payment_status, but ONLY down to "pending".
 *    A customer can never set their own order to "paid"/"refunded"/
 *    "failed" — that would let anyone mark their own order paid for free.
 *    The only path that may ever write "paid" is the Mercado Pago webhook
 *    (app/api/payment/mp-webhook/route.ts, via the service-role client,
 *    after re-verifying the payment with Mercado Pago's own API) or an
 *    admin validating a bank transfer by hand.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface PatchBody {
  payment_status?:      "pending" | "paid" | "refunded" | "failed"
  payment_provider?:    string
  status?:              string
  internal_note?:       string
  kanban_stage?:        "waiting_reception" | "scheduled_today" | "in_progress" | "completed"
  delivery_option?:     "pickup" | "delivery"
  delivery_address?:    string
  completion_photo_url?: string
  pes_notified_at?:     string
  pes_file_url?:        string
}

// Fields a non-admin may touch, and ONLY on their own order.
const CUSTOMER_EDITABLE_FIELDS = ["payment_provider", "delivery_option", "delivery_address"] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  const isAdmin = profile?.role === "admin"

  const body: PatchBody = await request.json()

  // Build update object — only include keys that were sent
  const update: Record<string, unknown> = {}

  if (isAdmin) {
    if (body.payment_status      !== undefined) update.payment_status      = body.payment_status
    if (body.payment_provider    !== undefined) update.payment_provider    = body.payment_provider
    if (body.status              !== undefined) update.status              = body.status
    if (body.internal_note       !== undefined) update.internal_note       = body.internal_note
    if (body.kanban_stage        !== undefined) update.kanban_stage        = body.kanban_stage
    if (body.delivery_option     !== undefined) update.delivery_option     = body.delivery_option
    if (body.delivery_address    !== undefined) update.delivery_address    = body.delivery_address
    if (body.completion_photo_url !== undefined) update.completion_photo_url = body.completion_photo_url
    if (body.pes_notified_at     !== undefined) update.pes_notified_at     = body.pes_notified_at
    if (body.pes_file_url        !== undefined) update.pes_file_url        = body.pes_file_url
  } else {
    // Not an admin — must be the order's own customer, and only for the
    // safe, self-service subset of fields.
    const { data: order } = await supabase
      .from("orders").select("customer_id").eq("id", id).single()

    if (!order || order.customer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (body.payment_provider !== undefined) update.payment_provider = body.payment_provider
    if (body.delivery_option  !== undefined) update.delivery_option  = body.delivery_option
    if (body.delivery_address !== undefined) update.delivery_address = body.delivery_address
    // A customer may only move their own payment_status to "pending"
    // (e.g. "I selected bank transfer, awaiting manual validation") —
    // never to "paid"/"refunded"/"failed".
    if (body.payment_status !== undefined) {
      if (body.payment_status !== "pending") {
        return NextResponse.json(
          { error: "No autorizado para fijar ese estado de pago" },
          { status: 403 }
        )
      }
      update.payment_status = "pending"
    }

    const sentKeys = Object.keys(body)
    const disallowed = sentKeys.filter(
      (k) => !CUSTOMER_EDITABLE_FIELDS.includes(k as typeof CUSTOMER_EDITABLE_FIELDS[number]) && k !== "payment_status"
    )
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `Campos no permitidos para un cliente: ${disallowed.join(", ")}` },
        { status: 403 }
      )
    }
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id, payment_status, status, kanban_stage")
    .single()

  if (error) {
    console.error("[PATCH /api/orders/:id]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: data })
}
