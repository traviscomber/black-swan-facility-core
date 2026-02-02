'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const handleLanguageChange = (newLocale: string) => {
    // Remove current locale from pathname
    const segments = pathname.split('/').filter(Boolean)
    const pathWithoutLocale = segments[0] === locale ? '/' + segments.slice(1).join('/') : pathname

    // Navigate to new locale
    if (newLocale === 'en') {
      router.push(pathWithoutLocale === '/' ? '/' : pathWithoutLocale)
    } else {
      router.push(`/${newLocale}${pathWithoutLocale}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-600" />
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[120px] h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="es">Español</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
