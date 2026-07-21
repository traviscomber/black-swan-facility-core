import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { timingSafeEqual } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{
    status?: string
    message?: string
  }>
}

const USERS = [
  {
    name: "Juan Vial",
    email: "juan@n3uralia.com",
    appMetadata: {
      procurement_role: "admin",
    },
  },
  {
    name: "Raimundo Colvin",
    email: "raimundo@blackswn.org",
    appMetadata: {
      procurement_role: "approver",
      procurement_approval_limit_clp: 25_000_000,
    },
  },
  {
    name: "Santiago Colvin",
    email: "santiago@blackswn.org",
    appMetadata: {
      procurement_role: "approver",
      procurement_approval_limit_clp: 25_000_000,
    },
  },
] as const

function secureCompare(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function findUserByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase()

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw new Error(`No se pudieron consultar usuarios: ${error.message}`)
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    )

    if (user) {
      return user
    }

    if (data.users.length < 1000) {
      break
    }
  }

  return null
}

async function provisionUsers(formData: FormData) {
  "use server"

  const setupSecret = String(formData.get("setupSecret") ?? "")
  const password = String(formData.get("password") ?? "")

  const expectedSecret = process.env.PROCUREMENT_SETUP_SECRET

  if (!expectedSecret) {
    redirect(
      "/admin/procurement-users?status=error&message=" +
        encodeURIComponent("Falta PROCUREMENT_SETUP_SECRET en Vercel."),
    )
  }

  if (!secureCompare(setupSecret, expectedSecret)) {
    redirect(
      "/admin/procurement-users?status=error&message=" +
        encodeURIComponent("Código de autorización incorrecto."),
    )
  }

  if (password.length < 12) {
    redirect(
      "/admin/procurement-users?status=error&message=" +
        encodeURIComponent("La contraseña debe tener al menos 12 caracteres."),
    )
  }

  const supabase = getSupabaseAdmin()
  const results: string[] = []

  try {
    for (const account of USERS) {
      const existingUser = await findUserByEmail(supabase, account.email)

      if (existingUser) {
        const { error } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password,
            user_metadata: {
              ...(existingUser.user_metadata ?? {}),
              full_name: account.name,
              name: account.name,
            },
            app_metadata: {
              ...(existingUser.app_metadata ?? {}),
              ...account.appMetadata,
            },
          },
        )

        if (error) {
          throw new Error(
            `No se pudo actualizar ${account.email}: ${error.message}`,
          )
        }

        results.push(`${account.name}: actualizado`)
        continue
      }

      const { error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: account.name,
          name: account.name,
        },
        app_metadata: account.appMetadata,
      })

      if (error) {
        throw new Error(
          `No se pudo crear ${account.email}: ${error.message}`,
        )
      }

      results.push(`${account.name}: creado`)
    }

    redirect(
      "/admin/procurement-users?status=success&message=" +
        encodeURIComponent(results.join(" · ")),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido"

    redirect(
      "/admin/procurement-users?status=error&message=" +
        encodeURIComponent(message),
    )
  }
}

export default async function ProcurementUsersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const success = params.status === "success"

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Black Swan Facility Core
            </p>

            <h1 className="text-3xl font-bold">
              Crear usuarios de procurement
            </h1>

            <p className="mt-3 text-sm text-muted-foreground">
              Crea las tres cuentas o actualiza sus contraseñas, nombres y
              permisos si ya existen.
            </p>
          </div>

          {params.message && (
            <div
              className={`mb-6 rounded-lg border p-4 text-sm ${
                success
                  ? "border-green-500/40 bg-green-500/10 text-green-600"
                  : "border-red-500/40 bg-red-500/10 text-red-600"
              }`}
            >
              {params.message}
            </div>
          )}

          <div className="mb-8 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Permiso</th>
                </tr>
              </thead>

              <tbody>
                {USERS.map((user) => (
                  <tr key={user.email} className="border-t">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.appMetadata.procurement_role === "admin"
                        ? "Administrador"
                        : "Aprobador — CLP 25.000.000"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={provisionUsers} className="space-y-5">
            <div>
              <label
                htmlFor="setupSecret"
                className="mb-2 block text-sm font-medium"
              >
                Código de autorización
              </label>

              <input
                id="setupSecret"
                name="setupSecret"
                type="password"
                required
                autoComplete="off"
                className="w-full rounded-md border bg-background px-3 py-2"
                placeholder="PROCUREMENT_SETUP_SECRET"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Contraseña temporal para los tres usuarios
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={12}
                defaultValue="blackswan2026"
                autoComplete="new-password"
                className="w-full rounded-md border bg-background px-3 py-2"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Los usuarios deben cambiar esta contraseña después del primer
                acceso.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90"
            >
              Crear o actualizar usuarios
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}