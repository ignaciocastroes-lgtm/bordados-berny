/**
 * app/acceso-taller/page.tsx  →  /acceso-taller
 *
 * Login de admin como URL propia (no escondido dentro de la pantalla de
 * clientes). No vive bajo /admin/* a propósito: middleware.ts exige sesión
 * admin para todo lo que empiece con /admin, y esta es justamente la
 * página para ANTES de tener esa sesión.
 */

export const dynamic = "force-dynamic"

import { AdminLoginScreen } from "@/components/admin-login-screen"

export default function AccesoTallerPage() {
  return <AdminLoginScreen />
}
