import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null = null

function createBuildSafeDummyClient(): SupabaseClient {
  const emptyResult = async () => ({ data: null, error: null })
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    like: () => query,
    ilike: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    single: emptyResult,
    maybeSingle: emptyResult,
    then: <TResult1 = { data: null; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected),
  }

  const dummy = {
    auth: {
      getSession: emptyResult,
      getUser: emptyResult,
      signOut: emptyResult,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            id: "build-safe-dummy",
            callback: () => undefined,
            unsubscribe: () => undefined,
          },
        },
      }),
    },
    from: () => query,
    rpc: emptyResult,
    storage: {
      from: () => ({
        download: emptyResult,
        upload: emptyResult,
        remove: emptyResult,
        createSignedUrl: emptyResult,
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    channel: () => ({
      on: function () { return this },
      subscribe: function () { return this },
      unsubscribe: emptyResult,
    }),
    removeChannel: emptyResult,
  }

  return dummy as unknown as SupabaseClient
}

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    if (typeof window === "undefined") return createBuildSafeDummyClient()
    throw new Error("Supabase URL and ANON_KEY are required")
  }

  if (!cachedClient) cachedClient = createSupabaseBrowserClient(url, key)
  return cachedClient
}

export { createClient as createBrowserClient }
