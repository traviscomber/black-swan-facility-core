import type React from "react"
import type { Metadata, Viewport } from "next"
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

export const metadata: Metadata = {
  title: "BSFC | Blackswan Facility Core",
  description: "Blackswan Facility Core internal system for operational management, facility traceability and user-based access control.",
  applicationName: "Blackswan Facility Core",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/blackswan-favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
  other: { google: "notranslate", "color-scheme": "dark" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#171512",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      translate="no"
      className="dark notranslate"
      data-theme="dark"
      style={{ colorScheme: "dark", backgroundColor: "#171512" }}
      suppressHydrationWarning
    >
      <body className={`${montserrat.variable} antialiased notranslate`}>
        <ClientProviders>
          {children}
          <Analytics />
        </ClientProviders>
      </body>
    </html>
  )
}
