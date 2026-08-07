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

  const disabledClass = 'flex-1 text-xs'

  if (!mounted) {
    return (
      <div className="grid w-full grid-cols-3 gap-2">
        <Button size="sm" className={disabledClass} disabled>English</Button>
        <Button size="sm" className={disabledClass} disabled>Español</Button>
        <Button size="sm" className={disabledClass} disabled>Deutsch</Button>
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-3 gap-2">
      <Button
        variant={language === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="text-xs"
      >
        English
      </Button>
      <Button
        variant={language === 'es' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('es')}
        className="text-xs"
      >
        Español
      </Button>
      <Button
        variant={language === 'de' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('de')}
        className="text-xs"
      >
        Deutsch
      </Button>
    </div>
  )
}
