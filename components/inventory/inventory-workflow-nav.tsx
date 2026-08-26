"use client"

import Link from "next/link"
import { ClipboardCheck, ClipboardList, PackageSearch, ShoppingCart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function InventoryWorkflowNav() {
  return <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Flujo Compras → Inventario → Control físico</p><p className="text-sm text-muted-foreground">Recepción, clasificación, stock consumible, kardex y conteos cíclicos.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/procurement/receiving"><ShoppingCart className="mr-2 h-4 w-4" />Recepciones</Link></Button><Button variant="outline" asChild><Link href="/inventory/intake"><ClipboardCheck className="mr-2 h-4 w-4" />Cola de ingreso</Link></Button><Button variant="outline" asChild><Link href="/inventory/stock"><PackageSearch className="mr-2 h-4 w-4" />Stock y kardex</Link></Button><Button variant="outline" asChild><Link href="/inventory/counts"><ClipboardList className="mr-2 h-4 w-4" />Conteos cíclicos</Link></Button></div></CardContent></Card>
}
