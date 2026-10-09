"use client"

/**
 * components/cookie-consent.tsx
 *
 * Banner de consentimiento de datos — Ley N° 21.719 sobre Protección de
 * Datos Personales (Chile). Esta WebApp guarda datos personales reales
 * (nombre, teléfono, dirección, imágenes de referencia, pedidos) en
 * Supabase, así que necesita consentimiento informado y revocable antes
 * de tratarlos — mismo requisito, misma solución, que en la web de
 * marketing (components/cookie-consent.tsx allí también).
 *
 * Simple a propósito: esta app no corre analítica de terceros todavía, así
 * que no hay nada que "activar" al aceptar — el valor de este banner es
 * informar y dejar constancia del consentimiento (localStorage) y dar un
 * link a la política de privacidad y una forma de revocarlo.
 */

import { useEffect, useState } from "react"
import { Cookie } from "lucide-react"

export const COOKIE_CONSENT_KEY = "bb-cookie-consent"
export type ConsentValue = "accepted" | "rejected"

export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(COOKIE_CONSENT_KEY)
  return v === "accepted" || v === "rejected" ? v : null
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getStoredConsent() === null)

    function handleReopen() {
      setVisible(true)
    }
    window.addEventListener("bb-cookie-consent-reopen", handleReopen)
    return () => window.removeEventListener("bb-cookie-consent-reopen", handleReopen)
  }, [])

  if (!visible) return null

  function choose(value: ConsentValue) {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentimiento de datos personales"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-stone-200 bg-white/98 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm md:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-stone-700">
            Guardamos tus datos (nombre, teléfono, dirección, imágenes de referencia) para gestionar tu pedido, de
            acuerdo a la <span className="font-semibold text-stone-800">Ley N° 21.719 de Protección de Datos Personales</span>.
            Puedes revisar el detalle en{" "}
            <a href="/politica-de-privacidad" className="underline underline-offset-2 hover:text-emerald-700">
              nuestra política de privacidad
            </a>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:border-emerald-400"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
