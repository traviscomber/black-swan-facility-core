import type React from "react"

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }]
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return children
}
