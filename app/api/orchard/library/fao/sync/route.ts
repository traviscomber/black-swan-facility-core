import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FAO_WCA_CSV = "https://stats.fao.org/caliper/download/WCA2020Crops/WCACROPS-core.csv"
const SOURCE_PAGE = "https://www.fao.org/statistics/caliper/classifications/wca/en"
const SOURCE_KEY = "fao_wca_2020"
const CHUNK_SIZE = 200

type CatalogItem = { externalId:string; name:string; scientificName:string|null; iccCode:string|null }
type ExistingCrop = { id:string; crop_name:string; external_source:string|null; external_id:string|null }

function parseCsv(input:string){const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;for(let i=0;i<input.length;i+=1){const char=input[i];if(char==='"'){if(quoted&&input[i+1]==='"'){field+='"';i+=1}else quoted=!quoted}else if(char===","&&!quoted){row.push(field.trim());field=""}else if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&input[i+1]==="\n")i+=1;row.push(field.trim());field="";if(row.some(Boolean))rows.push(row);row=[]}else field+=char}if(field||row.length){row.push(field.trim());if(row.some(Boolean))rows.push(row)}return rows}
function normalizeHeader(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function pickIndex(headers:string[],exact:string[],contains:string[]){for(const candidate of exact){const i=headers.indexOf(candidate);if(i>=0)return i}for(const candidate of contains){const i=headers.findIndex(header=>header.includes(candidate));if(i>=0)return i}return -1}
function nameFromUri(value:string){try{const last=new URL(value).pathname.split("/").filter(Boolean).pop()??"";return decodeURIComponent(last).replace(/[_-]+/g," ").trim()}catch{return ""}}
function parseCatalog(csv:string){
  const rows=parseCsv(csv);if(rows.length<2)throw new Error("FAO crop list returned no rows")
  const headers=rows[0].map(normalizeHeader)
  const codeIndex=pickIndex(headers,["code","notation","skos_notation","item_code"],["notation","code"])
  const nameIndex=pickIndex(headers,["vernacular_name","vernacular_name_en","alternative_label","alternative_label_en","alt_label","alt_label_en","altlabel","altlabel_en","skos_altlabel","skos_altlabel_en","common_name","common_name_en","title_en","label_en","name_en"],["vernacular","alternative_label","alt_label","altlabel","common_name"])
  const scientificIndex=pickIndex(headers,["scientific_name","scientificname","dwc_scientificname","pref_label_lat","preflabel_lat","preferred_label_lat","latin_label","label_lat"],["scientific","label_lat","latin"])
  const uriIndex=pickIndex(headers,["uri","concept_uri","subject","concept"],["uri"])
  const iccIndex=pickIndex(headers,["icc_1_1_code","icc11_code","icc_code"],["icc_1_1","icc11"])
  if(nameIndex<0&&uriIndex<0)throw new Error("FAO WCA crop-list schema changed")
  const seen=new Set<string>();const items:CatalogItem[]=[]
  for(let index=1;index<rows.length;index+=1){const row=rows[index];const name=((nameIndex>=0?(row[nameIndex]??""):"")||(uriIndex>=0?nameFromUri(row[uriIndex]??""):"")).trim();if(!name)continue;const key=name.toLowerCase();if(seen.has(key))continue;seen.add(key);items.push({externalId:(codeIndex>=0?(row[codeIndex]??"").trim():"")||`wca-${index}`,name,scientificName:scientificIndex>=0?(row[scientificIndex]??"").trim()||null:null,iccCode:iccIndex>=0?(row[iccIndex]??"").trim()||null:null})}
  return items
}
function chunks<T>(items:T[],size:number){const result:T[][]=[];for(let i=0;i<items.length;i+=size)result.push(items.slice(i,i+size));return result}

export async function POST(){
  const supabase=await createClient()
  const {data:authData}=await supabase.auth.getUser()
  if(!authData.user)return NextResponse.json({error:"Unauthorized"},{status:401})
  const {data:role,error:roleError}=await supabase.rpc("current_app_role")
  if(roleError)return NextResponse.json({error:"Could not verify role"},{status:500})
  if(role!=="admin")return NextResponse.json({error:"Admin required"},{status:403})

  const {data:run,error:runError}=await supabase.from("orchard_reference_sync_runs").insert({source_key:SOURCE_KEY,source_url:FAO_WCA_CSV,status:"running",requested_by:authData.user.id}).select("id").single()
  if(runError||!run)return NextResponse.json({error:"Could not start sync audit"},{status:500})

  try{
    const response=await fetch(FAO_WCA_CSV,{cache:"no-store"})
    if(!response.ok)throw new Error(`FAO crop list unavailable (${response.status})`)
    const catalog=parseCatalog(await response.text())
    const {data:existingData,error:existingError}=await supabase.from("orchard_crop_library").select("id,crop_name,external_source,external_id")
    if(existingError)throw new Error(existingError.message)
    const existing=(existingData??[]) as ExistingCrop[]
    const byName=new Map(existing.map(row=>[row.crop_name.trim().toLowerCase(),row]))
    let upserted=0;let skipped=0
    const inserts:{crop_name:string;scientific_name:string|null;source_name:string;source_url:string;source_verified_at:string;provenance_type:"reference";external_source:string;external_id:string;classification_scheme:string|null;classification_code:string|null}[]=[]
    const verificationTime=new Date().toISOString()

    for(const item of catalog){
      const current=byName.get(item.name.toLowerCase())
      if(current){
        if(current.external_source===SOURCE_KEY&&current.external_id===item.externalId){skipped+=1;continue}
        if(current.external_source||current.external_id){skipped+=1;continue}
        const {error}=await supabase.from("orchard_crop_library").update({external_source:SOURCE_KEY,external_id:item.externalId,classification_scheme:item.iccCode?"FAO ICC 1.1":null,classification_code:item.iccCode}).eq("id",current.id)
        if(error)throw new Error(error.message)
        upserted+=1
        continue
      }
      inserts.push({crop_name:item.name,scientific_name:item.scientificName,source_name:"FAO WCA 2020 Crop List",source_url:SOURCE_PAGE,source_verified_at:verificationTime,provenance_type:"reference",external_source:SOURCE_KEY,external_id:item.externalId,classification_scheme:item.iccCode?"FAO ICC 1.1":null,classification_code:item.iccCode})
    }

    for(const chunk of chunks(inserts,CHUNK_SIZE)){
      const {error}=await supabase.from("orchard_crop_library").insert(chunk)
      if(error)throw new Error(error.message)
      upserted+=chunk.length
    }

    const {error:completeError}=await supabase.from("orchard_reference_sync_runs").update({status:"completed",fetched_count:catalog.length,upserted_count:upserted,skipped_count:skipped,completed_at:new Date().toISOString()}).eq("id",run.id)
    if(completeError)throw new Error(completeError.message)
    return NextResponse.json({status:"completed",source:SOURCE_KEY,fetched:catalog.length,upserted,skipped,runId:run.id})
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown sync error"
    await supabase.from("orchard_reference_sync_runs").update({status:"failed",error_message:message,completed_at:new Date().toISOString()}).eq("id",run.id)
    return NextResponse.json({error:"FAO sync failed",detail:message,runId:run.id},{status:502})
  }
}
