# Procurement Users Setup - Guía Completa

## Sistema Profesional de Creación de Usuarios

Este sistema utiliza el Admin API de Supabase con seguridad de nivel empresarial para crear y gestionar los usuarios de procurement.

## Los 3 Usuarios

### 1. **Juan Vial** (Administrador)
- **Email:** `juan@n3uralia.com`
- **Rol:** `admin`
- **Límite de Aprobación:** Ilimitado
- **Función:** Director ejecutivo / CFO
- **Permisos:** Aprobar cualquier monto, acceso a auditoría completa

### 2. **Raimundo Colvin** (Aprobador Senior)
- **Email:** `raimundo@blackswn.org`
- **Rol:** `approver`
- **Límite de Aprobación:** CLP 25,000,000
- **Función:** Director de operaciones / Jefe de compras
- **Permisos:** Aprobar hasta CLP 25M

### 3. **Santiago Colvin** (Aprobador Senior)
- **Email:** `santiago@blackswn.org`
- **Rol:** `approver`
- **Límite de Aprobación:** CLP 25,000,000
- **Función:** Gerente de procurement / Supervisor
- **Permisos:** Aprobar hasta CLP 25M

---

## Proceso de Setup

### Paso 1: Preparar Variables de Entorno

En tu proyecto Vercel, agrega estas variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]
PROCUREMENT_SETUP_SECRET=[código-seguro-de-autorización]
```

**Generar PROCUREMENT_SETUP_SECRET:**
```bash
openssl rand -base64 32
```

### Paso 2: Aplicar Migración SQL

En Supabase Console → SQL Editor, ejecuta:
`supabase/migrations/20260721_procurement_users_setup.sql`

Esto crea:
- ✅ Tabla `procurement_approvers`
- ✅ Tabla `approver_audit_log`
- ✅ Funciones de seguridad (`is_procurement_approver`, `get_procurement_approval_limit_clp`)
- ✅ Políticas RLS
- ✅ Índices de performance

### Paso 3: Acceder a la Página de Admin

URL: `http://localhost:3000/admin/procurement-users`

### Paso 4: Crear/Actualizar Usuarios

1. **Ingresar Código de Autorización**
   - El valor de `PROCUREMENT_SETUP_SECRET` que configuraste

2. **Ingresar Contraseña Temporal**
   - Default: `blackswan2026` (puedes cambiar)
   - Debe tener al menos 12 caracteres

3. **Hacer Click en "Crear o actualizar usuarios"**

### Paso 5: Resultados

Verás uno de estos mensajes:

✅ **Éxito:**
```
Juan Vial: creado · Raimundo Colvin: creado · Santiago Colvin: creado
```

✅ **Si ya existen:**
```
Juan Vial: actualizado · Raimundo Colvin: actualizado · Santiago Colvin: actualizado
```

---

## Seguridad

### Características de Seguridad

- ✅ **Timing-safe comparison** del código de autorización (previene timing attacks)
- ✅ **Service Role Key** - solo accesible desde servidor
- ✅ **Email confirmation automática** - usuarios no necesitan confirmar email
- ✅ **Metadata segura** - roles y límites en app_metadata
- ✅ **RLS Policies** - acceso granular basado en roles
- ✅ **Auditoría** - todas las aprobaciones se registran

### Qué NO es un secreto

El código que ves en `/app/admin/procurement-users/page.tsx`:
- ✅ Está protegido por PROCUREMENT_SETUP_SECRET
- ✅ Solo se ejecuta con autorización
- ✅ No contiene credenciales reales

---

## Flujo de Login y Aprobación

```
1. Usuario va a /auth/login
   ↓
2. Ingresa email y contraseña
   ↓
3. Supabase autentica
   ↓
4. Sistema verifica roles en app_metadata
   ↓
5. Si es approver → acceso a /procurement/approvals
   ↓
6. Puede aprobar/rechazar hasta su límite
   ↓
7. Cada decisión se audita en approver_audit_log
```

---

## Pruebas

### Login Test

1. Ve a `http://localhost:3000/auth/login`
2. Email: `juan@n3uralia.com`
3. Password: `blackswan2026` (o la que configuraste)
4. Deberías ver: Dashboard + botón Logout

### Approvals Test

1. Estando logueado como Juan, ve a `/procurement/approvals`
2. Deberías ver: Lista de solicitudes pendientes
3. Haz click en una solicitud para ver detalles
4. Puedes aprobar o rechazar con notas

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "Falta PROCUREMENT_SETUP_SECRET" | Agregar variable en Vercel Settings |
| "Código de autorización incorrecto" | Verificar que PROCUREMENT_SETUP_SECRET es correcto |
| "La contraseña debe tener 12 caracteres" | Ingresar contraseña más larga |
| "No se pudo crear usuario" | Verificar que SUPABASE_SERVICE_ROLE_KEY es válida |
| "Usuario no puede ver aprobaciones" | Verificar que migración SQL se ejecutó |

---

## Próximos Pasos

- [ ] Aplicar migración SQL
- [ ] Configurar variables de entorno en Vercel
- [ ] Acceder a `/admin/procurement-users`
- [ ] Crear los 3 usuarios
- [ ] Cambiar contraseñas en primer login
- [ ] Probar login y approvals
- [ ] Crear solicitudes de procurement de prueba

---

**Stack:** Supabase Auth + Next.js Server Actions + RLS + Auditoría
