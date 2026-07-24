import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"

let cachedClient: any = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build/prerendering without env vars, return dummy client
  if (!url || !key) {
    if (typeof window === "undefined") {
      // Server-side during build
      return {
        auth: { getSession: async () => ({ data: null }) },
        from: () => ({ select: () => ({ eq: () => ({}), single: () => ({}) }) }),
        storage: { from: () => ({ download: () => ({}), upload: () => ({}) }) },
      } as any
    }
    // Client-side error - env vars should be available
    throw new Error("Supabase URL and ANON_KEY are required")
  }

  if (!cachedClient) {
    cachedClient = createSupabaseBrowserClient(url, key)
  }

  return cachedClient
}

export { createClient as createBrowserClient }
