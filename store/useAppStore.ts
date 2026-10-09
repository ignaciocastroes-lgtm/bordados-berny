"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// ─── Role ─────────────────────────────────────────────────────────────────────
export type UserRole = "unauthenticated" | "customer" | "admin"

// ─── Order Payload ────────────────────────────────────────────────────────────
export type GarmentType = "pantalon" | "short" | "blusa" | "polera" | "poleron" | "otro" | "bordado"
export type EmbroideryMode = "image" | "text"
export type EmbroiderySize = "10x10" | "13x18" | "18x26"

const MATRIX_BASE_PRICES: Record<EmbroiderySize, number> = {
  "10x10": 3000,
  "13x18": 7000,
  "18x26": 10000,
}
const TEXT_DISCOUNT = 0.20

export function calculateMatrixPrice(size: EmbroiderySize | null, mode: EmbroideryMode | null): number {
  if (!size || !mode) return 0
  const base = MATRIX_BASE_PRICES[size]
  return mode === "text" ? Math.round(base * (1 - TEXT_DISCOUNT)) : base
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
}

const DEFAULT_ORDER: OrderPayload = {
  garmentType: null,
  photos: { front: null, back: null, detail: null },
  description: "",
  embroidery: { mode: null, size: null, calculatedPrice: 0, hasTextDiscount: false },
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
          const hasTextDiscount = mode === "text" && size !== null && size !== "10x10"
          return { order: { ...state.order, embroidery: { ...state.order.embroidery, mode, calculatedPrice, hasTextDiscount } } }
        }),

      setEmbroiderySize: (size) =>
        set((state) => {
          const mode = state.order.embroidery.mode
          const calculatedPrice = calculateMatrixPrice(size, mode)
          const hasTextDiscount = mode === "text" && size !== "10x10"
          return { order: { ...state.order, embroidery: { ...state.order.embroidery, size, calculatedPrice, hasTextDiscount } } }
        }),

      resetOrder: () => set({ order: DEFAULT_ORDER }),
    }),
    {
      name: "bb-app-store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ userRole: state.userRole }),
    }
  )
)
