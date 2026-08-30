import { OsWorkspace } from '@/components/os-workspace'
import type { Language } from '@/lib/hooks/use-language'

const supportedLocales: Language[] = ['en', 'es', 'de']
void supportedLocales

export default function Page() {
  return <OsWorkspace workspace="people" />
}
