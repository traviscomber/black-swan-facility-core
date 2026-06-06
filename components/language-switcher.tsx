'use client'

import { useLanguage } from '@/lib/hooks/use-language'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex gap-2 w-full">
        <Button size="sm" className="flex-1 text-xs" disabled>
          English
        </Button>
        <Button size="sm" className="flex-1 text-xs" disabled>
          Español
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 w-full">
      <Button
        variant={language === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="flex-1 text-xs"
      >
        English
      </Button>
      <Button
        variant={language === 'es' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('es')}
        className="flex-1 text-xs"
      >
        Español
      </Button>
    </div>
  )
}
