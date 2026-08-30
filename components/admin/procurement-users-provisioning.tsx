"use client"

import { useLanguage } from "@/lib/hooks/use-language"

const COPY = {
  en: { title: "Provision procurement users", description: "Create the three accounts or update their passwords, names, and permissions if they already exist.", user: "User", email: "Email", permission: "Permission", admin: "Administrator", approver: "Approver — CLP 25,000,000", secret: "Authorization code", password: "Temporary password for all three users", passwordHelp: "Users must change this password after their first sign-in.", submit: "Create or update users", success: "Procurement users were provisioned successfully.", invalidSecret: "The authorization code is incorrect.", shortPassword: "The temporary password must contain at least 12 characters.", unavailable: "Provisioning is not configured for this environment.", failed: "The users could not be provisioned. Review the server logs and try again." },
  es: { title: "Crear usuarios de procurement", description: "Crea las tres cuentas o actualiza sus contraseñas, nombres y permisos si ya existen.", user: "Usuario", email: "Correo", permission: "Permiso", admin: "Administrador", approver: "Aprobador — CLP 25.000.000", secret: "Código de autorización", password: "Contraseña temporal para los tres usuarios", passwordHelp: "Los usuarios deben cambiar esta contraseña después del primer acceso.", submit: "Crear o actualizar usuarios", success: "Los usuarios de procurement fueron configurados correctamente.", invalidSecret: "El código de autorización es incorrecto.", shortPassword: "La contraseña temporal debe tener al menos 12 caracteres.", unavailable: "El aprovisionamiento no está configurado para este entorno.", failed: "No fue posible configurar los usuarios. Revisa los logs del servidor e inténtalo nuevamente." },
  de: { title: "Procurement-Benutzer einrichten", description: "Die drei Konten erstellen oder vorhandene Kennwörter, Namen und Berechtigungen aktualisieren.", user: "Benutzer", email: "E-Mail", permission: "Berechtigung", admin: "Administrator", approver: "Genehmiger — CLP 25.000.000", secret: "Autorisierungscode", password: "Temporäres Kennwort für alle drei Benutzer", passwordHelp: "Die Benutzer müssen dieses Kennwort nach der ersten Anmeldung ändern.", submit: "Benutzer erstellen oder aktualisieren", success: "Die Procurement-Benutzer wurden erfolgreich eingerichtet.", invalidSecret: "Der Autorisierungscode ist falsch.", shortPassword: "Das temporäre Kennwort muss mindestens 12 Zeichen enthalten.", unavailable: "Die Benutzerbereitstellung ist für diese Umgebung nicht konfiguriert.", failed: "Die Benutzer konnten nicht eingerichtet werden. Prüfe die Serverlogs und versuche es erneut." },
} as const

type Account = { name: string; email: string; role: "admin" | "approver" }

type ProvisioningAction = (formData: FormData) => void | Promise<void>

export function ProcurementUsersProvisioning({ accounts, action, status, code }: { accounts: Account[]; action: ProvisioningAction; status?: string; code?: string }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const message = status === "success" ? copy.success : code === "invalid-secret" ? copy.invalidSecret : code === "short-password" ? copy.shortPassword : code === "not-configured" ? copy.unavailable : status === "error" ? copy.failed : null

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-8"><p className="mb-2 text-sm font-medium text-muted-foreground">Black Swan Facility Core</p><h1 className="text-3xl font-bold">{copy.title}</h1><p className="mt-3 text-sm text-muted-foreground">{copy.description}</p></div>
          {message && <div className={`mb-6 rounded-lg border p-4 text-sm ${status === "success" ? "border-green-500/40 bg-green-500/10 text-green-600" : "border-red-500/40 bg-red-500/10 text-red-600"}`}>{message}</div>}
          <div className="mb-8 overflow-hidden rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="px-4 py-3">{copy.user}</th><th className="px-4 py-3">{copy.email}</th><th className="px-4 py-3">{copy.permission}</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.email} className="border-t"><td className="px-4 py-3 font-medium">{account.name}</td><td className="px-4 py-3">{account.email}</td><td className="px-4 py-3">{account.role === "admin" ? copy.admin : copy.approver}</td></tr>)}</tbody></table></div>
          <form action={action} className="space-y-5">
            <input type="hidden" name="locale" value={language} />
            <div><label htmlFor="setupSecret" className="mb-2 block text-sm font-medium">{copy.secret}</label><input id="setupSecret" name="setupSecret" type="password" required autoComplete="off" className="w-full rounded-md border bg-background px-3 py-2" placeholder="PROCUREMENT_SETUP_SECRET" /></div>
            <div><label htmlFor="password" className="mb-2 block text-sm font-medium">{copy.password}</label><input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="w-full rounded-md border bg-background px-3 py-2" /><p className="mt-2 text-xs text-muted-foreground">{copy.passwordHelp}</p></div>
            <button type="submit" className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90">{copy.submit}</button>
          </form>
        </div>
      </div>
    </main>
  )
}
