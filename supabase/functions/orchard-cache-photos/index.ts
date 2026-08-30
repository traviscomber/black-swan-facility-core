import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'orchard-crop-photos'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const normalizeTitle = (v: string) => v.replace(/_/g, ' ').trim().toLowerCase()

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'crop'
}
function extFor(mime: string, url: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('svg')) return 'svg'
  if (mime.includes('avif')) return 'avif'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  return url.match(/\.([a-zA-Z0-9]{2,5})(?:$|[?#])/)?.[1]?.toLowerCase() || 'jpg'
}
function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function commonsTitle(sourcePage: string | null) {
  if (!sourcePage || !sourcePage.includes('commons.wikimedia.org/wiki/File:')) return null
  try {
    return decodeURIComponent(new URL(sourcePage).pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ')
  } catch { return null }
}
async function fetchRetry(url: string) {
  let last: Response | null = null
  for (const delay of [0, 900, 2200]) {
    if (delay) await sleep(delay)
    const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'BlackSwan-Orchard-Image-Cache/1.1' } })
    last = response
    if (response.ok || response.status !== 429) return response
  }
  return last!
}

Deno.serve(async (req) => {
  const runToken = Deno.env.get('ORCHARD_PHOTO_CACHE_TOKEN')
  if (!runToken || req.headers.get('x-orchard-sync') !== runToken) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || '12')))
  const secretJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  const secretKey = secretJson ? JSON.parse(secretJson)['default'] : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: rows, error: readError } = await supabase
    .from('orchard_crop_photo_registry')
    .select('crop_name,photo_url,source_photo_url,source_page,verification_status,cache_status')
    .eq('verification_status', 'verified')
    .neq('cache_status', 'ready')
    .order('crop_name', { ascending: true })
    .limit(limit)
  if (readError) return Response.json({ error: readError.message }, { status: 500 })
  if (!rows?.length) return Response.json({ count: 0, ok: 0, failed: [], done: true })

  const commonsRows = rows.map((row: any) => ({ row, title: commonsTitle(row.source_page) })).filter((item: any) => item.title)
  const commonsMap = new Map<string, any>()
  if (commonsRows.length) {
    const apiUrl = new URL('https://commons.wikimedia.org/w/api.php')
    apiUrl.searchParams.set('action', 'query')
    apiUrl.searchParams.set('format', 'json')
    apiUrl.searchParams.set('origin', '*')
    apiUrl.searchParams.set('prop', 'imageinfo')
    apiUrl.searchParams.set('iiprop', 'url|mime|size|timestamp|user|extmetadata')
    apiUrl.searchParams.set('iiurlwidth', '1600')
    apiUrl.searchParams.set('titles', commonsRows.map((item: any) => item.title).join('|'))
    const apiRes = await fetchRetry(apiUrl.toString())
    if (apiRes.ok) {
      const payload = await apiRes.json()
      for (const page of Object.values(payload?.query?.pages || {}) as any[]) {
        const ii = page?.imageinfo?.[0]
        if (page?.title && ii) commonsMap.set(normalizeTitle(page.title), { page, ii })
      }
    }
  }

  async function processRow(row: any) {
    const originalSource = row.source_photo_url || row.photo_url
    const title = commonsTitle(row.source_page)
    const resolved = title ? commonsMap.get(normalizeTitle(title)) : null
    const ii = resolved?.ii
    const fetchUrl = ii?.thumburl || ii?.url || originalSource
    try {
      const response = await fetchRetry(fetchUrl)
      if (!response.ok) throw new Error(`source HTTP ${response.status}`)
      const mime = (response.headers.get('content-type') || ii?.mime || '').split(';')[0].trim().toLowerCase()
      if (!mime.startsWith('image/')) throw new Error(`not image: ${mime || 'unknown'}`)
      const bytes = await response.arrayBuffer()
      if (!bytes.byteLength) throw new Error('empty image')
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error(`image too large: ${bytes.byteLength}`)
      const sha = toHex(await crypto.subtle.digest('SHA-256', bytes))
      const path = `crops/${slugify(row.crop_name)}/${sha.slice(0, 20)}.${extFor(mime, response.url || fetchUrl)}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: mime,
        cacheControl: '31536000',
        upsert: false,
        metadata: { crop_name: row.crop_name, source_url: originalSource, source_page: row.source_page || '', sha256: sha },
      })
      if (uploadError && !String(uploadError.message).toLowerCase().includes('already exists')) throw uploadError
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const sourceMetadata = ii ? {
        provider: 'Wikimedia Commons', original_url: ii.url, thumb_url: ii.thumburl || null,
        original_width: ii.width || null, original_height: ii.height || null,
        thumb_width: ii.thumbwidth || null, thumb_height: ii.thumbheight || null,
        mime: ii.mime || null, timestamp: ii.timestamp || null, uploader: ii.user || null,
        extmetadata: ii.extmetadata || null,
      } : { provider: new URL(originalSource).hostname, final_url: response.url || fetchUrl }
      const publicUrl = publicData.publicUrl
      const { error: updateError } = await supabase.from('orchard_crop_photo_registry').update({
        source_photo_url: originalSource, photo_url: publicUrl, storage_bucket: BUCKET, storage_path: path,
        storage_public_url: publicUrl, mime_type: mime, byte_size: bytes.byteLength, sha256: sha,
        source_etag: response.headers.get('etag'), source_last_modified: response.headers.get('last-modified'),
        cache_control: '31536000', cached_at: new Date().toISOString(), cache_status: 'ready',
        source_final_url: response.url || fetchUrl, image_width: ii?.thumbwidth || ii?.width || null,
        image_height: ii?.thumbheight || ii?.height || null, source_metadata: sourceMetadata,
        updated_at: new Date().toISOString(),
      }).eq('crop_name', row.crop_name)
      if (updateError) throw updateError
      return { crop_name: row.crop_name, ok: true, bytes: bytes.byteLength, path }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await supabase.from('orchard_crop_photo_registry').update({ cache_status: 'failed', updated_at: new Date().toISOString(), notes: `Cache failure: ${message}` }).eq('crop_name', row.crop_name)
      return { crop_name: row.crop_name, ok: false, error: message }
    }
  }

  const results: any[] = []
  for (const row of rows) {
    results.push(await processRow(row))
    await sleep(120)
  }
  return Response.json({ count: rows.length, ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), done: false })
})
