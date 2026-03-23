'use client'

import { AppLayout } from '@/components/app-layout'

export default function VineyardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
