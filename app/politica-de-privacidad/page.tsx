"use client"

/**
 * app/politica-de-privacidad/page.tsx  →  /politica-de-privacidad
 *
 * Página standalone (sin layout de admin/wizard) con la política de
 * privacidad real de la WebApp, exigida por la Ley N° 21.719. Enlazada
 * desde el banner de consentimiento (components/cookie-consent.tsx).
 */

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default function PoliticaDePrivacidadPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="stitch-container sticky top-0 z-10 flex items-center gap-3 px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="p-1 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-bold text-stone-800">Política de Privacidad</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8 text-stone-700">
        <p className="text-xs text-stone-400">Última actualización: octubre de 2026</p>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-semibold text-stone-800">1. Quiénes somos</h2>
          <p className="text-sm leading-relaxed">
            Bordados Berny ("nosotros") gestiona pedidos de bordado, confección y digitalización de matrices
            textiles a través de esta WebApp. Esta política explica qué datos personales recopilamos y cómo los
            tratamos, conforme a la{" "}
            <span className="font-semibold text-stone-800">Ley N° 21.719 sobre Protección de Datos Personales</span>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-semibold text-stone-800">2. Qué datos recopilamos</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>Nombre, correo, teléfono y dirección de entrega, al crear tu cuenta o un pedido.</li>
            <li>Imágenes de referencia que subes para bordados o matrices digitales (.pes).</li>
            <li>Información de pago procesada por Mercado Pago — nosotros no almacenamos tu tarjeta.</li>
            <li>Fotos del trabajo terminado y archivos .pes entregados, asociados a tu pedido.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-semibold text-stone-800">3. Para qué los usamos</h2>
          <p className="text-sm leading-relaxed">
            Usamos tus datos únicamente para gestionar tu pedido (cotización, producción, entrega y pago) y
            comunicarnos contigo por WhatsApp sobre su estado. No vendemos ni compartimos tus datos con terceros
            ajenos al servicio — solo con los proveedores que lo hacen posible: Mercado Pago (pagos) y Supabase
            (almacenamiento seguro).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-semibold text-stone-800">4. Dónde se guardan tus archivos</h2>
          <p className="text-sm leading-relaxed">
            Tus imágenes de referencia y archivos .pes se guardan en un almacenamiento privado (Supabase Storage) y
            solo son accesibles por ti mismo y por el equipo de Bordados Berny mediante enlaces firmados y con
            vencimiento.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-semibold text-stone-800">5. Tus derechos</h2>
          <p className="text-sm leading-relaxed">
            Puedes pedirnos en cualquier momento acceder, corregir o eliminar tus datos personales, o revocar tu
            consentimiento para su tratamiento, escribiéndonos por WhatsApp al +56 9 5189 6142. Responderemos tu
            solicitud dentro de un plazo razonable.
          </p>
        </section>
      </div>
    </div>
  )
}
