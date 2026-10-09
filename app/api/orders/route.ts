/**
 * app/api/orders/route.ts
 *
 * POST /api/orders — persists a completed Wizard submission to Supabase.
 *
 * Called from app/wizard/page.tsx handleComplete() instead of just
 * navigating. RLS on the orders table enforces that customer_id === auth.uid().
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[POST /api/orders] No hay usuario autenticado:", authError?.message)
    return NextResponse.json({ error: "Unauthorized — no hay sesión activa" }, { status: 401 })
  }

  // ── Parse body (mirrors OrderPayload from Zustand store) ──────────────────
  const body = await request.json()

  const {
    garmentType,
    photos,
    description,
    embroidery,
    designImageUrls,
  } = body

  console.log("[POST /api/orders] Usuario:", user.id, "· Payload:", body)

  // Basic validation
  if (!garmentType || !description || description.length < 10) {
    console.error("[POST /api/orders] Payload inválido:", { garmentType, descriptionLength: description?.length })
    return NextResponse.json(
      { error: "Faltan datos: garmentType y description (mínimo 10 caracteres) son obligatorios" },
      { status: 400 }
    )
  }

  // ── Build the row ─────────────────────────────────────────────────────────
  const row = {
    customer_id:         user.id,
    garment_type:        garmentType,
    photo_front_url:     photos?.front  ?? null,
    photo_back_url:      photos?.back   ?? null,
    photo_detail_url:    photos?.detail ?? null,
    // Reference image(s) for "Digitalizar Imagen" orders — uploaded for
    // real client-side (embroidery-wizard.tsx handleProceedToPayment)
    // before this request, as signed design-uploads Storage URLs.
    design_image_urls:   Array.isArray(designImageUrls) && designImageUrls.length > 0
                           ? designImageUrls
                           : null,
    description,
    // Embroidery fields — only when garmentType === 'bordado'
    embroidery_mode:     embroidery?.mode     ?? null,
    embroidery_size:     embroidery?.size     ?? null,
    embroidery_text:     embroidery?.text     ?? null,
    font_style:          embroidery?.fontStyle ?? null,
    scheduled_date:      embroidery?.scheduledDate ?? null,
    scheduled_time:      embroidery?.scheduledTime ?? null,
    total_price:         embroidery?.calculatedPrice ?? 0,
    has_text_discount:   embroidery?.hasTextDiscount ?? false,
    status:              "Recibido" as const,
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("orders")
    .insert(row)
    .select("id")
    .single()

  if (error) {
    // Surface Postgrest's full error shape — code/details/hint are the
    // fastest way to diagnose RLS denials vs. schema mismatches vs. bad data.
    console.error("[POST /api/orders] Supabase insert falló:", {
      message: error.message,
      details: error.details,
      hint:    error.hint,
      code:    error.code,
      row,
    })
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      { status: 500 }
    )
  }

  console.log("[POST /api/orders] Pedido creado con éxito:", data.id)
  return NextResponse.json({ orderId: data.id }, { status: 201 })
}
