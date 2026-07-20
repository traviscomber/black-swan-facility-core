# 3 Usuarios Listos para Crear - Procurement Approvals System

## Resumen Rápido

Los 3 usuarios están pre-configurados en la migración SQL `20260721_setup_auth_users.sql` listos para ser creados en Supabase. Solo necesitas ejecutar la migración.

---

## 👥 Los 3 Usuarios

### 1️⃣ **Admin - Aprobador Ilimitado**
```
Email:    admin@blackswan.com
Password: TemporaryPassword123!
Rol:      admin
Límite:   Ilimitado (sin límite de CLP)
Status:   Activo
```
**Permisos:** 
- ✅ Aprobar cualquier solicitud sin límite monetario
- ✅ Ver todas las solicitudes de procurement
- ✅ Gestionar otros aprobadores
- ✅ Acceso a auditoría completa

**Caso de Uso:** Director ejecutivo o CFO que necesita aprobar solicitudes sin restricción presupuestaria

---

### 2️⃣ **Approver - Aprobador Estándar (CLP 5M)**
```
Email:    approver@blackswan.com
Password: TemporaryPassword123!
Rol:      approver
Límite:   CLP 5,000,000
Status:   Activo
```
**Permisos:**
- ✅ Aprobar solicitudes hasta CLP 5M
- ✅ Ver todas las solicitudes de procurement
- ✅ Rechazar cualquier solicitud
- ✅ Ver historial de auditoría

**Caso de Uso:** Jefe de compras o departamento financiero

---

### 3️⃣ **Approver2 - Aprobador Senior (CLP 10M)**
```
Email:    approver2@blackswan.com
Password: TemporaryPassword123!
Rol:      approver
Límite:   CLP 10,000,000
Status:   Activo
```
**Permisos:**
- ✅ Aprobar solicitudes hasta CLP 10M
- ✅ Ver todas las solicitudes de procurement
- ✅ Rechazar cualquier solicitud
- ✅ Ver historial de auditoría

**Caso de Uso:** Gerente sénior o director de operaciones

---

## 🚀 Cómo Crear Los Usuarios

### Paso 1: Ejecutar la Migración SQL

1. Ve a **Supabase Console** → **SQL Editor**
2. Crea una nueva query
3. Copia el contenido completo de: `/supabase/migrations/20260721_setup_auth_users.sql`
4. Haz click en **"Run"**

La migración creará:
- ✅ 3 cuentas en `auth.users`
- ✅ 3 registros en `procurement_approvers` table
- ✅ Políticas RLS de seguridad
- ✅ Funciones de auditoría

### Paso 2: Cambiar Contraseñas (IMPORTANTE)

Después de la primera migración, **cada usuario debe cambiar su contraseña temporal** en su primer login:

1. Login con `admin@blackswan.com` / `TemporaryPassword123!`
2. El sistema debería solicitar cambio de contraseña
3. Establecer una contraseña segura
4. Repetir para los otros 2 usuarios

### Paso 3: Verificar Que Los Usuarios Existen

**Query para verificar en Supabase:**

```sql
SELECT 
  email,
  id,
  created_at
FROM auth.users
WHERE email LIKE '%@blackswan.com'
ORDER BY email;

-- Debería mostrar:
-- admin@blackswan.com
-- approver@blackswan.com
-- approver2@blackswan.com
```

---

## 🔑 Estructura de Credenciales

### Base de Datos (procurement_approvers table)

| Email | ID | Rol | Límite CLP | Activo |
|-------|----|----|-----------|--------|
| admin@blackswan.com | 00000000-0000-0000-0000-000000000001 | admin | NULL (∞) | ✅ |
| approver@blackswan.com | 00000000-0000-0000-0000-000000000002 | approver | 5,000,000 | ✅ |
| approver2@blackswan.com | 00000000-0000-0000-0000-000000000003 | approver | 10,000,000 | ✅ |

---

## 🔒 Flujo de Autenticación

```
1. Usuario visita http://localhost:3000/auth/login
   ↓
2. Ingresa email@blackswan.com + contraseña
   ↓
3. Supabase Auth valida credenciales
   ↓
4. Sesión creada (cookie sb-access-token)
   ↓
5. Redirige a /procurement/approvals
   ↓
6. Middleware verifica sesión
   ↓
7. Función is_procurement_approver() valida rol
   ↓
8. Muestra solicitudes según límite de aprobación
```

---

## 📋 Checklist de Setup

- [ ] Ejecutar migración SQL en Supabase
- [ ] Verificar que los 3 usuarios existen en auth.users
- [ ] Verificar que existen en procurement_approvers table
- [ ] Login como admin@blackswan.com - cambiar contraseña
- [ ] Login como approver@blackswan.com - cambiar contraseña
- [ ] Login como approver2@blackswan.com - cambiar contraseña
- [ ] Probar flujo de aprobación con cada usuario
- [ ] Verificar límites de aprobación funcionan correctamente
- [ ] Revisar auditoría logs en approver_audit_log
- [ ] Documentar contraseñas en gestor seguro

---

## 🚨 Seguridad - Importante

**NUNCA dejes las contraseñas temporales:**
- Las contraseñas por defecto son `TemporaryPassword123!`
- Cada usuario DEBE cambiarla en el primer login
- Usa contraseñas únicas y fuertes
- Almacena en 1Password, Vaultwarden, o similar
- No compartas vía email o chat

---

## ❓ Preguntas Frecuentes

### ¿Puedo agregar más aprobadores después?

Sí, con esta query en Supabase SQL Editor:

```sql
-- Primero crear usuario en auth.users vía UI
-- Luego ejecutar:

INSERT INTO public.procurement_approvers (
  user_id,
  role,
  approval_limit_clp,
  is_active
) VALUES (
  'UUID_DEL_NUEVO_USUARIO',
  'approver',
  20000000, -- CLP 20M
  true
);
```

### ¿Cómo cambio el límite de aprobación?

```sql
UPDATE public.procurement_approvers
SET approval_limit_clp = 15000000
WHERE email = 'approver@blackswan.com';
```

### ¿Cómo deshabilito un aprobador?

```sql
UPDATE public.procurement_approvers
SET is_active = false
WHERE email = 'approver@blackswan.com';
```

### ¿Dónde veo el auditoría de aprobaciones?

- Tabla: `approver_audit_log`
- Contiene: usuario, acción, IP, timestamp, resultado
- Query:

```sql
SELECT 
  action,
  details,
  ip_address,
  created_at
FROM public.approver_audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## 📞 Soporte

Si hay problemas:
1. Verifica que la migración SQL ejecutó sin errores
2. Revisa logs en Supabase → Database → Error logs
3. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env
4. Prueba el flujo en navegador con DevTools abierto (F12)
