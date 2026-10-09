"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
// Lógica de precios movida a lib/pricing.ts (server-safe, sin "use client")
// para que app/api/orders/route.ts pueda recalcular el precio ahí sin
// arriesgar evaluar `sessionStorage` en Node. Se re-exporta todo acá para no
// romper los imports existentes (ej. components/admin-settings.tsx).
import {
  MATRIX_BASE_PRICES,
  TEXT_DISCOUNT,
  calculateMatrixPrice,
  hasTextDiscount as calcHasTextDiscount,
  type EmbroideryMode,
  type EmbroiderySize,
} from "@/lib/pricing"
import type { NfcUseCase } from "@/lib/nfc"

export { MATRIX_BASE_PRICES, TEXT_DISCOUNT, calculateMatrixPrice }
export type { EmbroideryMode, EmbroiderySize }

// ─── Role ─────────────────────────────────────────────────────────────────────
export type UserRole = "unauthenticated" | "customer" | "admin"

// ─── Order Payload ────────────────────────────────────────────────────────────
// Ronda 10: "llavero_nfc" — producto estrella de la web pública, hasta ahora
// solo cotizable por WhatsApp. Ver lib/nfc.ts para los casos de uso y la
// tabla nfc_profiles (Fase 2 — página pública que abre el chip).
export type GarmentType =
  | "pantalon"
  | "short"
  | "blusa"
  | "polera"
  | "poleron"
  | "otro"
  | "bordado"
  | "llavero_nfc"

export interface NfcOrderData {
  useCase: NfcUseCase | null
  content: string
  quantity: number
}

export interface OrderPayload {
  garmentType: GarmentType | null
  photos: { front: string | null; back: string | null; detail: string | null }
  description: string
  embroidery: {
    mode: EmbroideryMode | null
    size: EmbroiderySize | null
    calculatedPrice: number
    hasTextDiscount: boolean
  }
  nfc: NfcOrderData
}

const DEFAULT_NFC: NfcOrderData = { useCase: null, content: "", quantity: 1 }

const DEFAULT_ORDER: OrderPayload = {
  garmentType: null,
  photos: { front: null, back: null, detail: null },
  description: "",
  embroidery: { mode: null, size: null, calculatedPrice: 0, hasTextDiscount: false },
  nfc: DEFAULT_NFC,
}

// ─── Store shape ──────────────────────────────────────────────────────────────
interface AppState {
  userRole: UserRole
  setUserRole: (role: UserRole) => void
  logout: () => void
  order: OrderPayload
  setGarmentType: (garment: GarmentType) => void
  setPhoto: (slot: "front" | "back" | "detail", url: string | null) => void
  setDescription: (text: string) => void
  setEmbroideryMode: (mode: EmbroideryMode) => void
  setEmbroiderySize: (size: EmbroiderySize) => void
  setNfcUseCase: (useCase: NfcUseCase) => void
  setNfcContent: (content: string) => void
  setNfcQuantity: (quantity: number) => void
  resetOrder: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      userRole: "unauthenticated",
      setUserRole: (role) => set({ userRole: role }),
      logout: () => set({ userRole: "unauthenticated", order: DEFAULT_ORDER }),

      order: DEFAULT_ORDER,

      setGarmentType: (garment) =>
        set((state) => ({
          order: {
            ...state.order,
            garmentType: garment,
            embroidery: garment === "bordado" ? state.order.embroidery : DEFAULT_ORDER.embroidery,
            nfc: garment === "llavero_nfc" ? state.order.nfc : DEFAULT_NFC,
          },
        })),

      setPhoto: (slot, url) =>
        set((state) => ({ order: { ...state.order, photos: { ...state.order.photos, [slot]: url } } })),

      setDescription: (text) =>
        set((state) => ({ order: { ...state.order, description: text } })),

      setEmbroideryMode: (mode) =>
        set((state) => {
          const size = state.order.embroidery.size
          const calculatedPrice = calculateMatrixPrice(size, mode)
          const hasTextDiscount = calcHasTextDiscount(size, mode)
          return { order: { ...state.order, embroidery: { ...state.order.embroidery, mode, calculatedPrice, hasTextDiscount } } }
        }),

      setEmbroiderySize: (size) =>
        set((state) => {
          const mode = state.order.embroidery.mode
          const calculatedPrice = calculateMatrixPrice(size, mode)
          const hasTextDiscount = calcHasTextDiscount(size, mode)
          return { order: { ...state.order, embroidery: { ...state.order.embroidery, size, calculatedPrice, hasTextDiscount } } }
        }),

      setNfcUseCase: (useCase) =>
        set((state) => ({ order: { ...state.order, nfc: { ...state.order.nfc, useCase } } })),

      setNfcContent: (content) =>
        set((state) => ({ order: { ...state.order, nfc: { ...state.order.nfc, content } } })),

      setNfcQuantity: (quantity) =>
        set((state) => ({ order: { ...state.order, nfc: { ...state.order.nfc, quantity: Math.max(1, quantity) } } })),

      resetOrder: () => set({ order: DEFAULT_ORDER }),
    }),
    {
      name: "bb-app-store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ userRole: state.userRole }),
    }
  )
)
