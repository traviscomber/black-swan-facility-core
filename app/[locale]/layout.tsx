import type React from "react"
import { getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { ClientProviders } from "@/components/client-providers"

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
    <NextIntlClientProvider messages={messages} locale={locale}>
      <ClientProviders>
        {children}
      </ClientProviders>
    </NextIntlClientProvider>
  )
}
