import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  var supabaseClientInstance: SupabaseClient | undefined
}

export function createClient() {
  // Return existing instance if available
  if (globalThis.supabaseClientInstance) {
    return globalThis.supabaseClientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    )
  }

  globalThis.supabaseClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return globalThis.supabaseClientInstance
}

export { createClient as createBrowserClient }
