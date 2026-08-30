"use client"

import { useMemo, useState } from "react"
import { CheckCircle, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseBusinessPlanExcel, type BusinessPlanData } from "@/lib/cattle/business-plan-parser"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface BusinessPlanUploadProps { onDataLoaded?: (data: BusinessPlanData[]) => void }
const COPY={
  en:{title:"Import business plan",description:"Load an Excel or CSV file with projections for the Breeding and Fattening regimes.",processing:"Processing…",drop:"Choose an Excel or CSV file",support:"Supports .xlsx, .xls and .csv",select:"Select file",success:"Business plan imported successfully",error:"The file could not be processed."},
  es:{title:"Importar plan de negocios",description:"Carga un archivo Excel o CSV con proyecciones para los regímenes de Crianza y Engorda.",processing:"Procesando…",drop:"Selecciona un archivo Excel o CSV",support:"Soporta .xlsx, .xls y .csv",select:"Seleccionar archivo",success:"Plan importado exitosamente",error:"No fue posible procesar el archivo."},
  de:{title:"Geschäftsplan importieren",description:"Excel- oder CSV-Datei mit Projektionen für Zucht und Mast laden.",processing:"Verarbeitung…",drop:"Excel- oder CSV-Datei auswählen",support:"Unterstützt .xlsx, .xls und .csv",select:"Datei auswählen",success:"Geschäftsplan erfolgreich importiert",error:"Die Datei konnte nicht verarbeitet werden."},
} as const

export function BusinessPlanUpload({onDataLoaded}:BusinessPlanUploadProps){
  const{language}=useLanguage();const lang=(language in COPY?language:"en") as keyof typeof COPY;const c=COPY[lang]
  const[uploading,setUploading]=useState(false);const[error,setError]=useState(false);const[success,setSuccess]=useState(false);const[fileName,setFileName]=useState("");const supabase=useMemo(()=>createBrowserClient(),[])
  const handleFileSelect=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setUploading(true);setError(false);setSuccess(false);try{const businessPlanData=await parseBusinessPlanExcel(file);if(businessPlanData.length===0)throw new Error("EMPTY_BUSINESS_PLAN");const{error:insertError}=await supabase.from("cattle_business_plan").insert(businessPlanData.map(item=>({year:item.year,month:item.month,inventory_count:item.inventory_count,purchase_amount:item.purchase_amount,sales_amount:item.sales_amount,operational_cost:item.operational_cost,profit_loss:item.profit_loss,business_unit:item.regime})));if(insertError)throw insertError;setFileName(file.name);setSuccess(true);onDataLoaded?.(businessPlanData);setTimeout(()=>setSuccess(false),3000)}catch(err){console.error("CATTLE_BUSINESS_PLAN_UPLOAD_FAILED",err);setError(true)}finally{setUploading(false);event.target.value=""}}
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5"/>{c.title}</CardTitle><CardDescription>{c.description}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border-2 border-dashed border-border p-8 text-center"><label className="cursor-pointer"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} disabled={uploading} className="hidden"/><div className="space-y-2"><Upload className="mx-auto h-8 w-8 text-muted-foreground"/><p className="text-sm font-medium">{uploading?c.processing:c.drop}</p><p className="text-xs text-muted-foreground">{c.support}</p><Button disabled={uploading} type="button" variant="outline" size="sm" className="mt-2">{uploading?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>{c.processing}</>:c.select}</Button></div></label></div>{success&&<div className="flex items-start gap-3 rounded-lg border p-3"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="text-sm font-medium">{c.success}</p><p className="mt-1 text-xs text-muted-foreground">{fileName}</p></div></div>}{error&&<div className="rounded-lg border border-destructive/40 p-3"><p className="text-sm font-medium text-destructive">{c.error}</p></div>}</CardContent></Card>
}
