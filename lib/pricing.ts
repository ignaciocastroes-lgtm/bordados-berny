/**
 * lib/pricing.ts
 *
 * Lógica de precios de la matriz de bordado — vive acá (no en
 * store/useAppStore.ts) porque ese store es "use client" y arma un store de
 * Zustand con `persist(() => sessionStorage)` a nivel de módulo; importarlo
 * desde una ruta server-only (app/api/orders/route.ts) para solo tomar
 * `calculateMatrixPrice()` arriesga evaluar `sessionStorage` en Node (SSR),
 * donde no existe. Esta es la única fuente de verdad del cálculo — tanto el
 * store (para la vista previa en el wizard) como la API (para el precio que
 * realmente se cobra) importan desde acá.
 */

export type EmbroideryMode = "image" | "text"
export type EmbroiderySize = "10x10" | "13x18" | "18x26"

export const MATRIX_BASE_PRICES: Record<EmbroiderySize, number> = {
  "10x10": 3000,
  "13x18": 7000,
  "18x26": 10000,
}
export const TEXT_DISCOUNT = 0.20

export function calculateMatrixPrice(
  size: EmbroiderySize | null | undefined,
  mode: EmbroideryMode | null | undefined
): number {
  if (!size || !mode) return 0
  const base = MATRIX_BASE_PRICES[size]
  if (base === undefined) return 0
  return mode === "text" ? Math.round(base * (1 - TEXT_DISCOUNT)) : base
}

export function hasTextDiscount(
  size: EmbroiderySize | null | undefined,
  mode: EmbroideryMode | null | undefined
): boolean {
  return mode === "text" && !!size && size !== "10x10"
}

const VALID_SIZES: EmbroiderySize[] = ["10x10", "13x18", "18x26"]
const VALID_MODES: EmbroideryMode[] = ["image", "text"]

export function isEmbroiderySize(v: unknown): v is EmbroiderySize {
  return typeof v === "string" && (VALID_SIZES as string[]).includes(v)
}

export function isEmbroideryMode(v: unknown): v is EmbroideryMode {
  return typeof v === "string" && (VALID_MODES as string[]).includes(v)
}
