import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { ClientProviders } from "@/components/client-providers"
import "@/app/globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BFCS - Blackswan Facility Core System",
  description:
    "Blackswan Facility Core System (BFCS) - Professional property management and facility operations platform for luxury vacation rentals and complex management",
  generator: "v0.app",
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#726658",
}

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }]
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} className="dark">
      <body className={`${_geist.className} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ClientProviders />
          {children}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
