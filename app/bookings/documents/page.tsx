"use client"

import Link from "next/link"
import { ExternalLink, FileArchive, FileCheck2, FileSpreadsheet, FileText, FolderLock, ShieldCheck } from "lucide-react"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { documentsCopy, documentTitles } from "@/lib/translations/documents"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const REPOSITORY_URL = "https://github.com/traviscomber/black-swan-facility-core"
const DOCUMENTS_URL = `${REPOSITORY_URL}/tree/main/docs/mutual`

const documentMeta = [
  { code: "00", type: "DOCX / PDF", icon: FileText },
  { code: "01", type: "DOCX / PDF", icon: ShieldCheck },
  { code: "02", type: "DOCX / PDF", icon: FileCheck2 },
  { code: "03", type: "DOCX / PDF", icon: FileText },
  { code: "04", type: "DOCX / PDF", icon: FileText },
  { code: "05", type: "DOCX / PDF", icon: FileText },
  { code: "06", type: "DOCX / PDF", icon: FileText },
  { code: "07", type: "DOCX / PDF", icon: FileCheck2 },
  { code: "08", type: "XLSX", icon: FileSpreadsheet },
  { code: "09", type: "DOCX", icon: FileCheck2 },
  { code: "10", type: "ZIP / PDF", icon: FileArchive },
]

export default function BookingDocumentsPage() {
  const { access, loading } = useEffectiveAccess()
  const { language } = useLanguage()
  const copy = documentsCopy[language]
  const titles = documentTitles[language]
  const allowed = access.is_admin || access.role === "approver"

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{copy.validating}</div>

  if (!allowed) {
    return <div className="mx-auto max-w-3xl p-6"><Alert variant="destructive"><FolderLock className="h-4 w-4" /><AlertTitle>{copy.restricted}</AlertTitle><AlertDescription>{copy.restrictedDesc}</AlertDescription></Alert></div>
  }

  return <main className="h-full overflow-y-auto bg-background p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2"><FolderLock className="h-5 w-5 text-primary" /><Badge variant="outline">{copy.controlled}</Badge></div><h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p></div><Button asChild variant="outline"><Link href={DOCUMENTS_URL} target="_blank" rel="noreferrer">{copy.openTechnical}<ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div>
    <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>{copy.controlTitle}</AlertTitle><AlertDescription>{copy.controlDesc}</AlertDescription></Alert>
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documentMeta.map((document, index) => { const Icon = document.icon; return <Card key={document.code} className="border-border/80 bg-card/80"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center border bg-muted"><Icon className="h-4 w-4" /></div><Badge variant="secondary">{document.type}</Badge></div><CardTitle className="pt-2 text-base">{document.code} · {titles[index]}</CardTitle><CardDescription>{copy.baseVersion}</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{copy.owner}</span><span>{copy.pendingReview}</span></div></CardContent></Card> })}</section>
    <Card><CardHeader><CardTitle className="text-base">{copy.administration}</CardTitle><CardDescription>{copy.administrationDesc}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button asChild><Link href={DOCUMENTS_URL} target="_blank" rel="noreferrer">{copy.viewMutual}<ExternalLink className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline"><Link href={REPOSITORY_URL} target="_blank" rel="noreferrer">{copy.viewGitHub}<ExternalLink className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
  </div></main>
}
