"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Boxes, RefreshCw, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type Intake = { id:string; receipt_item_id:string; intake_type:"asset"|"consumable"; status:string; reconciliation_status:string; created_at:string; notes:string|null }
type ReceiptItem = { id:string; request_id:string; received_quantity:number; condition:string; discrepancy_reason:string|null; receipt_id:string }
type Request = { id:string; title:string; category:string; unit:string; quantity:number }
type Receipt = { id:string; receipt_number:string|null; purchase_order_id:string }
type Order = { id:string; order_number:string|null }
type Option = { id:string; name:string; code?:string|null; warehouse_id?:string; warehouses?:{name:string}|null }
type ReplenishmentNeed = {
  procurement_request_id:string|null
  stock_item_id:string
  status:string
  inventory_stock_items:{
    item_code:string
    name:string
    warehouse_location_id:string
    minimum_stock:number
    warehouse_locations:{name:string;warehouses:{name:string}|{name:string}[]|null}|{name:string;warehouses:{name:string}|{name:string}[]|null}[]|null
  }|{
    item_code:string
    name:string
    warehouse_location_id:string
    minimum_stock:number
    warehouse_locations:{name:string;warehouses:{name:string}|{name:string}[]|null}|{name:string;warehouses:{name:string}|{name:string}[]|null}[]|null
  }[]|null
}

function firstRelation<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}

export default function InventoryIntakePage(){
 const supabase=useMemo(()=>createBrowserClient(),[]); const {toast}=useToast()
 const [intakes,setIntakes]=useState<Intake[]>([]); const [items,setItems]=useState<Record<string,ReceiptItem>>({}); const [requests,setRequests]=useState<Record<string,Request>>({}); const [receipts,setReceipts]=useState<Record<string,Receipt>>({}); const [orders,setOrders]=useState<Record<string,Order>>({}); const [replenishments,setReplenishments]=useState<Record<string,ReplenishmentNeed>>({})
 const [locations,setLocations]=useState<Option[]>([]); const [categories,setCategories]=useState<Option[]>([]); const [costCenters,setCostCenters]=useState<Option[]>([])
 const [selected,setSelected]=useState(""); const [locationId,setLocationId]=useState(""); const [categoryId,setCategoryId]=useState(""); const [costCenterId,setCostCenterId]=useState(""); const [assetClass,setAssetClass]=useState("equipment"); const [minimumStock,setMinimumStock]=useState("0"); const [notes,setNotes]=useState(""); const [loading,setLoading]=useState(true); const [processing,setProcessing]=useState(false); const [error,setError]=useState<string|null>(null)
 const load=useCallback(async()=>{setLoading(true);setError(null);const [a,b,c,d,e,f,g,h,i]=await Promise.all([
  supabase.from("procurement_inventory_intake").select("id,receipt_item_id,intake_type,status,reconciliation_status,created_at,notes").order("created_at",{ascending:false}),
  supabase.from("procurement_receipt_items").select("id,request_id,received_quantity,condition,discrepancy_reason,receipt_id"),
  supabase.from("procurement_requests").select("id,title,category,unit,quantity"),
  supabase.from("procurement_receipts").select("id,receipt_number,purchase_order_id"),
  supabase.from("procurement_purchase_orders").select("id,order_number"),
  supabase.from("warehouse_locations").select("id,name,code,warehouse_id,warehouses(name)").eq("is_active",true).order("name"),
  supabase.from("asset_categories").select("id,name,code").eq("is_active",true).order("name"),
  supabase.from("cost_centers").select("id,name,code").eq("is_active",true).order("name"),
  supabase.from("inventory_replenishment_needs").select("procurement_request_id,stock_item_id,status,inventory_stock_items(item_code,name,warehouse_location_id,minimum_stock,warehouse_locations(name,warehouses(name)))").in("status",["requested","approved","ordered","receiving"])
 ])
  const err=[a,b,c,d,e,f,g,h,i].find(x=>x.error)?.error;if(err){setError(err.message);setLoading(false);return}
  setIntakes((a.data??[]) as Intake[]);setItems(Object.fromEntries(((b.data??[]) as ReceiptItem[]).map(x=>[x.id,x])));setRequests(Object.fromEntries(((c.data??[]) as Request[]).map(x=>[x.id,x])));setReceipts(Object.fromEntries(((d.data??[]) as Receipt[]).map(x=>[x.id,x])));setOrders(Object.fromEntries(((e.data??[]) as Order[]).map(x=>[x.id,x])));setLocations((f.data??[]).map(x=>({...x,warehouses:firstRelation(x.warehouses)})));setCategories((g.data??[]) as Option[]);setCostCenters((h.data??[]) as Option[]);setReplenishments(Object.fromEntries(((i.data??[]) as unknown as ReplenishmentNeed[]).filter(x=>x.procurement_request_id).map(x=>[x.procurement_request_id as string,x])));setLoading(false)},[supabase])
 useEffect(()=>{void load()},[load]); const current=intakes.find(x=>x.id===selected); const pending=intakes.filter(x=>x.status==="pending"); const currentItem=current?items[current.receipt_item_id]:null; const currentNeed=currentItem?replenishments[currentItem.request_id]??null:null; const currentStock=firstRelation(currentNeed?.inventory_stock_items); const currentStockLocation=firstRelation(currentStock?.warehouse_locations); const currentWarehouse=firstRelation(currentStockLocation?.warehouses)
 useEffect(()=>{if(!current){setLocationId("");return}if(currentNeed&&currentStock){setLocationId(currentStock.warehouse_location_id);setMinimumStock(String(currentStock.minimum_stock??0));return}setLocationId("")},[current,currentNeed,currentStock])
 async function process(){if(!current)return;const destination=currentNeed&&currentStock?currentStock.warehouse_location_id:locationId;if(!destination)return;if(current.intake_type==="asset"&&(!categoryId||!costCenterId))return;setProcessing(true);const {data,error:rpcError}=await supabase.rpc("process_procurement_inventory_intake",{p_intake_id:current.id,p_warehouse_location_id:destination,p_asset_category_id:current.intake_type==="asset"?categoryId:null,p_cost_center_id:costCenterId||null,p_asset_class:assetClass,p_minimum_stock:currentNeed?0:Number(minimumStock||0),p_notes:notes.trim()||null});setProcessing(false);if(rpcError){toast({title:"No fue posible procesar el ingreso",description:rpcError.message,variant:"destructive"});return}toast({title:"Ingreso procesado",description:data?.type==="asset"?`${data.created} activo(s) creados.`:data?.replenishment_lineage?`Reposición aplicada al SKU de origen. Stock actualizado en ${data.quantity_added}.`:`Stock actualizado en ${data.quantity_added}.`});setSelected("");setLocationId("");setCategoryId("");setCostCenterId("");setNotes("");await load()}
 function label(intake:Intake){const item=items[intake.receipt_item_id];const request=item?requests[item.request_id]:null;const receipt=item?receipts[item.receipt_id]:null;const order=receipt?orders[receipt.purchase_order_id]:null;return `${order?.order_number??"OC"} · ${request?.title??"Ítem recibido"} · ${item?.received_quantity??0} ${request?.unit??""}`}
 return <AppLayout><PageHeader title="Ingreso a Inventario" description="Clasificación y conciliación de recepciones de compras." actions={<Button variant="outline" asChild><Link href="/inventory"><ArrowLeft className="mr-2 h-4 w-4"/>Inventario</Link></Button>}/><div className="space-y-6 p-4 sm:p-8">
  <div className="grid gap-4 sm:grid-cols-3"><Metric title="Pendientes" value={pending.length}/><Metric title="Procesados" value={intakes.filter(x=>x.status==="processed").length}/><Metric title="Con excepción" value={intakes.filter(x=>x.reconciliation_status==="exception").length} alert={intakes.some(x=>x.reconciliation_status==="exception")}/></div>
  {error&&<Card className="border-destructive/60"><CardContent className="flex items-center justify-between p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Reintentar</Button></CardContent></Card>}
  <Card><CardHeader><CardTitle>Cola pendiente</CardTitle><CardDescription>Los activos requieren categoría, centro de costo y ubicación. Una reposición consumible conserva el SKU y la ubicación física que originaron la compra.</CardDescription></CardHeader><CardContent className="space-y-4">
   {loading?<p className="py-8 text-center text-muted-foreground">Cargando cola…</p>:pending.length===0?<div className="py-10 text-center"><Boxes className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="font-medium">No hay recepciones pendientes de ingreso.</p><p className="mt-1 text-sm text-muted-foreground">Aparecerán aquí después de registrar una recepción con ingreso a inventario.</p></div>:<>
    <Select value={selected} onValueChange={setSelected}><SelectTrigger><SelectValue placeholder="Seleccionar recepción"/></SelectTrigger><SelectContent>{pending.map(x=><SelectItem key={x.id} value={x.id}>{label(x)}</SelectItem>)}</SelectContent></Select>
    {currentNeed&&currentStock&&<div className="flex gap-3 rounded-lg border border-emerald-300 bg-emerald-50/50 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><div><p className="font-medium text-emerald-900">Reposición con lineage protegido</p><p className="mt-1 text-emerald-800">SKU {currentStock.item_code} · {currentStock.name}. Este ingreso sólo puede volver a {currentWarehouse?.name??"Bodega"} · {currentStockLocation?.name??"su ubicación de origen"}; no se crea un SKU paralelo.</p></div></div>}
    {current&&<div className="grid gap-4 md:grid-cols-2"><Field label="Ubicación"><Select value={locationId} onValueChange={setLocationId} disabled={Boolean(currentNeed)}><SelectTrigger><SelectValue placeholder="Seleccionar ubicación"/></SelectTrigger><SelectContent>{locations.map(x=><SelectItem key={x.id} value={x.id}>{x.warehouses?.name??"Bodega"} · {x.name}</SelectItem>)}</SelectContent></Select></Field>
     <Field label="Centro de costo"><Select value={costCenterId} onValueChange={setCostCenterId}><SelectTrigger><SelectValue placeholder="Conservar actual / seleccionar"/></SelectTrigger><SelectContent>{costCenters.map(x=><SelectItem key={x.id} value={x.id}>{x.name}{x.code?` (${x.code})`:""}</SelectItem>)}</SelectContent></Select></Field>
     {current.intake_type==="asset"?<><Field label="Categoría de activo"><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Seleccionar categoría"/></SelectTrigger><SelectContent>{categories.map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Clase"><Select value={assetClass} onValueChange={setAssetClass}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="equipment">Equipo</SelectItem><SelectItem value="tool">Herramienta</SelectItem><SelectItem value="vehicle">Vehículo o maquinaria</SelectItem><SelectItem value="infrastructure">Infraestructura</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></Field></>:!currentNeed?<Field label="Stock mínimo"><Input type="number" min="0" value={minimumStock} onChange={e=>setMinimumStock(e.target.value)}/></Field>:<div><p className="text-sm font-medium">Stock mínimo</p><p className="mt-1 rounded-md border bg-muted/20 px-3 py-2 text-sm">Se conserva el mínimo actual: {currentStock?.minimum_stock??0}</p></div>}
     <div className="md:col-span-2"><label className="text-sm font-medium">Notas de ingreso</label><textarea className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={notes} onChange={e=>setNotes(e.target.value)}/></div><div className="md:col-span-2 flex justify-end"><Button onClick={()=>void process()} disabled={processing||!(currentNeed&&currentStock?currentStock.warehouse_location_id:locationId)||(current.intake_type==="asset"&&(!categoryId||!costCenterId))}>{processing?"Procesando…":currentNeed?"Aplicar reposición al SKU":"Procesar ingreso"}</Button></div></div>}
   </>}
  </CardContent></Card>
  <Card><CardHeader><CardTitle>Conciliación reciente</CardTitle></CardHeader><CardContent className="space-y-2">{intakes.slice(0,12).map(x=><div key={x.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{label(x)}</p><p className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString("es-CL")}</p></div><div className="flex gap-2"><Badge variant="outline">{x.intake_type==="asset"?"Activo":"Consumible"}</Badge><Badge variant="outline">{x.status}</Badge><Badge variant="outline">{x.reconciliation_status}</Badge></div></div>)}</CardContent></Card>
 </div></AppLayout>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="text-sm font-medium">{label}</label><div className="mt-1">{children}</div></div>}
function Metric({title,value,alert=false}:{title:string;value:number;alert?:boolean}){return <Card className={alert?"border-amber-300":undefined}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</CardContent></Card>}
