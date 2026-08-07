import type React from "react"
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { Montserrat } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ClientProviders } from "@/components/client-providers"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
})

export const revalidate = 0

const metadataDescriptions = {
  en: "Blackswan Facility Core internal system for operational management, facility traceability and user-based access control.",
  es: "Sistema interno de Blackswan Facility Core para la gestión operativa, trazabilidad de instalaciones y control de acceso por usuario.",
  de: "Internes System von Blackswan Facility Core für Betriebssteuerung, Anlagen-Nachverfolgbarkeit und benutzerbasierten Zugriffsschutz.",
} as const

type SiteLocale = keyof typeof metadataDescriptions

function resolveLocale(value: string | null): SiteLocale {
  return value === "de" || value === "es" || value === "en" ? value : "en"
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get("x-site-locale"))

  return {
    title: "BSFC | Blackswan Facility Core",
    description: metadataDescriptions[locale],
    applicationName: "Blackswan Facility Core",
    icons: {
      icon: [
        { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
        { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-icon.png",
    },
    robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#171512",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers()
  const documentLanguage = resolveLocale(requestHeaders.get("x-site-locale"))

  return (
    <html lang={documentLanguage} className="dark" suppressHydrationWarning>
      <body className={`${montserrat.variable} antialiased`}>
        <ClientProviders>
          {children}
          <Analytics />
        </ClientProviders>
      </body>
    </html>
  )
}
