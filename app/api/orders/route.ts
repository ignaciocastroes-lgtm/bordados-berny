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
import { calculateMatrixPrice, hasTextDiscount, isEmbroiderySize, isEmbroideryMode } from "@/lib/pricing"
import { sendNewOrderEmail } from "@/lib/email"
import { isNfcUseCase, generateNfcSlug } from "@/lib/nfc"

const GARMENT_LABELS: Record<string, string> = {
  pantalon: "Pantalón", short: "Short", blusa: "Blusa",
  polera: "Polera", poleron: "Polerón", otro: "Otro", bordado: "Bordado / Matriz Digital",
  llavero_nfc: "Llavero NFC",
}

// Reintentos razonables ante un choque de `unique` en nfc_profiles.slug —
// SLUG_ALPHABET son 32 caracteres ^ 8 de largo, la chance de choque es
// insignificante, pero nunca cero.
const MAX_SLUG_ATTEMPTS = 5

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
    quantity,
    nfc,
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

  // ── Precio: SIEMPRE recalculado server-side, nunca el que manda el cliente ──
  // FIX (root cause — tampering de precio): esto confiaba ciegamente en
  // `embroidery.calculatedPrice`/`hasTextDiscount` que vienen en el body del
  // POST, calculados client-side en store/useAppStore.ts. Cualquiera con
  // devtools/Postman podía mandar `calculatedPrice: 1` y crear un pedido de
  // bordado 18x26 por $1. app/api/payment/mp-preference/route.ts ya relee
  // `total_price` desde la BD antes de cobrar — pero ese valor nacía
  // contaminado porque nadie lo validaba al crear la orden. `size`/`mode`
  // se validan contra los enums reales antes de calcular: si vienen
  // corruptos o no reconocidos, el precio cae a 0 en vez de confiar en lo
  // que mandó el cliente.
  const embroiderySize = isEmbroiderySize(embroidery?.size) ? embroidery.size : null
  const embroideryMode = isEmbroideryMode(embroidery?.mode) ? embroidery.mode : null
  const serverCalculatedPrice = garmentType === "bordado"
    ? calculateMatrixPrice(embroiderySize, embroideryMode)
    : 0
  const serverHasTextDiscount = garmentType === "bordado"
    ? hasTextDiscount(embroiderySize, embroideryMode)
    : false

  // ── Llavero NFC: cantidad + caso de uso + contenido ─────────────────────────
  // Cotización manual (como cualquier prenda normal) — total_price queda en 0
  // acá también, Bernardita lo fija a mano desde /admin/tickets. Solo se
  // valida forma/rango, no se calcula nada de precio a partir de esto.
  const isLlaveroNfc = garmentType === "llavero_nfc"
  const serverQuantity = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1
  const nfcUseCase = isLlaveroNfc && isNfcUseCase(nfc?.useCase) ? nfc.useCase : null
  const nfcContent = isLlaveroNfc && typeof nfc?.content === "string" ? nfc.content.slice(0, 500) : null

  if (isLlaveroNfc && (!nfcUseCase || !nfcContent || nfcContent.trim().length < 5)) {
    return NextResponse.json(
      { error: "Para un llavero NFC se necesita un caso de uso y contenido (mínimo 5 caracteres)" },
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
    embroidery_mode:     embroideryMode,
    embroidery_size:     embroiderySize,
    embroidery_text:     embroidery?.text     ?? null,
    font_style:          embroidery?.fontStyle ?? null,
    scheduled_date:      embroidery?.scheduledDate ?? null,
    scheduled_time:      embroidery?.scheduledTime ?? null,
    total_price:         serverCalculatedPrice,
    has_text_discount:   serverHasTextDiscount,
    status:              "Recibido" as const,
    // Llavero NFC — Ronda 10
    quantity:            serverQuantity,
    nfc_use_case:        nfcUseCase,
    nfc_content:         nfcContent,
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

  // ── Ronda 10 (Fase 2): draft de nfc_profiles ────────────────────────────────
  // Una fila por llavero NFC vendido — la página pública que /nfc/[slug]
  // renderirá una vez que el cliente llene su contenido y Bernardita la
  // publique. No-fatal: si esto falla, el pedido ya creado se devuelve igual
  // — el cliente puede seguir el flujo por WhatsApp sin la página pública,
  // y Bernardita puede crear el perfil a mano después si hace falta.
  if (isLlaveroNfc && nfcUseCase) {
    let profileCreated = false
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !profileCreated; attempt++) {
      const slug = generateNfcSlug()
      const { error: profileError } = await supabase.from("nfc_profiles").insert({
        order_id: data.id,
        use_case: nfcUseCase,
        slug,
        is_published: false,
        template_data: {},
      })
      if (!profileError) {
        profileCreated = true
      } else if (profileError.code === "23505") {
        // Choque de unique en slug — reintenta con uno nuevo.
        console.warn("[POST /api/orders] Slug de nfc_profiles chocó, reintentando:", slug)
      } else {
        console.error("[POST /api/orders] No se pudo crear el draft de nfc_profiles:", profileError)
        break
      }
    }
    if (!profileCreated) {
      console.error("[POST /api/orders] nfc_profiles quedó sin crear tras", MAX_SLUG_ATTEMPTS, "intentos para el pedido", data.id)
    }
  }

  // ── Ronda 9: aviso a Bernardita por email, con las fotos ADJUNTAS DE
  // VERDAD (no un link, como en WhatsApp) ────────────────────────────────
  // No-fatal: si falta configuración o Resend falla, se loguea y el pedido
  // ya creado se devuelve igual — el cliente nunca debe ver un error por
  // esto. Se espera (await) antes de responder porque, en un Route Handler
  // serverless, trabajo en segundo plano sin await puede cortarse apenas
  // se manda la respuesta.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    const photos = [
      row.photo_front_url  && { url: row.photo_front_url,  filename: "foto-frontal.jpg" },
      row.photo_back_url   && { url: row.photo_back_url,   filename: "foto-trasera.jpg" },
      row.photo_detail_url && { url: row.photo_detail_url, filename: "foto-detalle.jpg" },
      ...(row.design_image_urls ?? []).map((url, i) => ({ url, filename: `diseno-${i + 1}.jpg` })),
    ].filter((p): p is { url: string; filename: string } => !!p)

    const emailResult = await sendNewOrderEmail({
      orderId: data.id,
      garmentLabel: GARMENT_LABELS[garmentType] ?? garmentType,
      description,
      customerName: profile?.full_name ?? null,
      customerPhone: profile?.phone ?? null,
      totalPrice: serverCalculatedPrice,
      photos,
    })

    if (!emailResult.ok) {
      console.warn("[POST /api/orders] Email de aviso no se pudo enviar:", emailResult.error)
    }
  } catch (err) {
    console.error("[POST /api/orders] Excepción mandando el email de aviso:", err)
  }

  return NextResponse.json({ orderId: data.id }, { status: 201 })
}
