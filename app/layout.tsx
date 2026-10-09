import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Bordados Berny - Sistema de Sastreria Inteligente",
  description: "Sistema de gestion de prendas y bordados para Bordados Berny",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png",  media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg",             type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
