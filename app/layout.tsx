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

export const metadata: Metadata = {
  title: "BSFC | Blackswan Facility Core",
  description:
    "Sistema interno de Blackswan Facility Core para la gestión operativa, trazabilidad de instalaciones y control de acceso por usuario.",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#171512",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers()
  const requestedLocale = requestHeaders.get("x-site-locale")
  const documentLanguage = requestedLocale === "de" || requestedLocale === "en" || requestedLocale === "es"
    ? requestedLocale
    : "en"

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
