'use client'

import { useLanguage } from '@/lib/language-context'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

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
