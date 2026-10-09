/**
 * lib/email.ts
 *
 * Ronda 9 — notificación por email a Bernardita con las fotos del pedido
 * ADJUNTAS DE VERDAD (no un link, como en WhatsApp — wa.me nunca puede
 * adjuntar un archivo real, solo texto). Usa la API REST de Resend
 * directamente por fetch(), sin agregar el paquete npm "resend": este
 * sandbox no tiene acceso al registro de npm para instalar nada nuevo, y
 * la API REST de Resend es un solo POST — no justifica una dependencia.
 *
 * No-fatal por diseño: si falta configuración (RESEND_API_KEY, EMAIL_FROM,
 * ADMIN_NOTIFICATION_EMAIL) o Resend/el fetch de una foto fallan, esto
 * loguea y retorna `{ ok: false }` — nunca lanza. Crear el pedido en
 * Supabase nunca debe fallar porque el email no pudo salir.
 *
 * Setup real (fuera de este repo):
 *  1. Crear cuenta en resend.com, verificar el dominio de envío (EMAIL_FROM
 *     tiene que ser de ese dominio, ej. pedidos@bordadosberny.cl).
 *  2. Generar un API key y ponerlo en RESEND_API_KEY (.env.local).
 *  3. ADMIN_NOTIFICATION_EMAIL = el correo real de Bernardita.
 */

interface OrderPhoto {
  url: string
  filename: string
}

interface NewOrderEmailInput {
  orderId: string
  garmentLabel: string
  description: string
  customerName: string | null
  customerPhone: string | null
  totalPrice: number
  photos: OrderPhoto[]
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

/** Descarga una foto y la convierte a base64 para mandarla como adjunto
 *  real de Resend. No-fatal por foto — si una falla, se omite y se sigue
 *  con las demás (mejor un email con 2 de 3 fotos que ningún email). */
async function fetchAsAttachment(photo: OrderPhoto): Promise<{ filename: string; content: string } | null> {
  try {
    const res = await fetch(photo.url)
    if (!res.ok) {
      console.error(`[lib/email] No se pudo descargar "${photo.filename}": HTTP ${res.status}`)
      return null
    }
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    return { filename: photo.filename, content: base64 }
  } catch (err) {
    console.error(`[lib/email] Excepción descargando "${photo.filename}":`, err)
    return null
  }
}

export async function sendNewOrderEmail(input: NewOrderEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey   = process.env.RESEND_API_KEY
  const from     = process.env.EMAIL_FROM
  const to       = process.env.ADMIN_NOTIFICATION_EMAIL

  if (!apiKey || !from || !to) {
    console.warn(
      "[lib/email] Email de aviso omitido — falta RESEND_API_KEY, EMAIL_FROM o ADMIN_NOTIFICATION_EMAIL en el entorno."
    )
    return { ok: false, error: "missing_config" }
  }

  // Máximo 5 adjuntos — un pedido normal trae 3 fotos de prenda o unas
  // pocas imágenes de referencia de bordado, nunca debería llegar a esto,
  // pero evita un payload gigante si algo manda de más.
  const attachments = (
    await Promise.all(input.photos.slice(0, 5).map(fetchAsAttachment))
  ).filter((a): a is { filename: string; content: string } => a !== null)

  const ref = `#${input.orderId.slice(0, 8).toUpperCase()}`

  const html = `
    <div style="font-family: sans-serif; color: #292524;">
      <h2 style="color: #047857;">Nuevo pedido ${ref}</h2>
      <p><strong>Cliente:</strong> ${input.customerName ?? "—"} ${input.customerPhone ? `(${input.customerPhone})` : ""}</p>
      <p><strong>Prenda:</strong> ${input.garmentLabel}</p>
      <p><strong>Descripción:</strong> ${input.description}</p>
      <p><strong>Total:</strong> ${input.totalPrice > 0 ? formatCLP(input.totalPrice) : "Por confirmar"}</p>
      ${attachments.length > 0
        ? `<p>${attachments.length} foto(s) adjunta(s).</p>`
        : `<p style="color:#a8a29e;">Sin fotos adjuntas en este pedido.</p>`}
    </div>
  `.trim()

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Bordados Berny — Nuevo pedido ${ref}`,
        html,
        attachments,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error("[lib/email] Resend rechazó el envío:", { status: res.status, body })
      return { ok: false, error: `resend_${res.status}` }
    }

    return { ok: true }
  } catch (err) {
    console.error("[lib/email] Excepción llamando a Resend:", err)
    return { ok: false, error: "fetch_exception" }
  }
}
