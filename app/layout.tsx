import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ClientProviders } from "@/components/client-providers"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const revalidate = 0

export const metadata: Metadata = {
  title: "BSFC | Blackswan Facility Core",
  description:
    "Sistema interno de Blackswan Facility Core para la gestión operativa, trazabilidad de instalaciones y control de acceso por usuario.",
  applicationName: "Blackswan Facility Core",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#726658",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`${_geist.className} font-sans antialiased`}>
        <ClientProviders>
          {children}
          <Analytics />
        </ClientProviders>
      </body>
    </html>
  )
}
