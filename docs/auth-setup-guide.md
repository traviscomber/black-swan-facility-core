# Authentication & Procurement Approvals Setup Guide

## Overview

This guide covers the complete authentication system for procurement approvals in Black Swan Facility Core System.

## Features Implemented

✅ **Supabase Auth Integration**
- Email/password authentication
- Secure session management with cookies
- Role-based access control

✅ **Procurement Approvers System**
- Admin-level approvers (unlimited budget)
- Standard approvers (configurable budget limits)
- Audit logging for all actions

✅ **Protected Routes**
- Automatic redirect to login for unauthenticated users
- Session validation via middleware
- Approver role verification

✅ **Audit Trail**
- All approval/rejection actions logged
- IP address and user agent tracking
- Immutable audit records

## Database Setup (SQL)

The authentication system requires running this migration in Supabase SQL Editor:

**File:** `supabase/migrations/20260721_setup_auth_users.sql`

This migration creates:
1. `procurement_approvers` table - Tracks who can approve and their limits
2. `approver_audit_log` table - Immutable audit trail
3. Demo user accounts (see below)
4. RLS security policies
5. Helper functions

**To apply the migration:**
1. Go to Supabase Console → SQL Editor
2. Create a new query
3. Copy the entire contents of `supabase/migrations/20260721_setup_auth_users.sql`
4. Click "Run"

## Demo Credentials

After running the migration, two demo accounts are pre-created:

### Admin Account
- **Email:** `admin@blackswan.com`
- **Initial Password:** `TemporaryPassword123!`
- **Role:** Admin (unlimited approval limit)
- **Action:** Change password immediately after first login

### Approver Account
- **Email:** `approver@blackswan.com`
- **Initial Password:** `TemporaryPassword123!`
- **Role:** Approver (CLP 5,000,000 limit)
- **Action:** Change password immediately after first login

## User Flow

### 1. Login
```
/auth/login → Email + Password → Supabase Auth → Session Created
```

### 2. Access Procurement Approvals
```
Logged In User → /procurement/approvals → Role Check → Show Requests or "Access Denied"
```

### 3. Approve/Reject Procurement Request
```
Select Request → Review Details → Approve/Reject → Decision Logged → Audit Trail Created
```

### 4. Logout
```
Click Logout Button → Session Destroyed → Redirect to /auth/login
```

## Architecture Components

### Frontend
- **`app/auth/login/page.tsx`** - Login form UI
- **`components/auth-logout-button.tsx`** - Logout button component
- **`lib/hooks/useAuth.ts`** - Hook to check user and approver status
- **`app/auth-provider.tsx`** - Auth context wrapper for protected routes

### Backend
- **`middleware.ts`** - Route protection and session validation
- **`lib/supabase/client.ts`** - Browser-side Supabase client
- **`lib/supabase/server.ts`** - Server-side Supabase client

### Database Functions
- **`is_procurement_approver()`** - Check if user has approver role
- **`log_approver_action()`** - Log actions to audit trail
- **`procurement_approval_limit_clp()`** - Get user's approval budget limit

## Security Policies

### Row Level Security (RLS)

**procurement_approvers table:**
- Users can only see their own record
- Admins can see all approver records
- Active status required

**approver_audit_log table:**
- Only active approvers can view logs
- Immutable records (INSERT only, no UPDATE/DELETE)

**procurement_requests table:**
- Requesters can only see/edit their own drafts
- Approvers can see all submitted requests
- Decisions stored in procurement_approval_events

## Managing Users

### Add New Approver

1. **Create Auth User (via Supabase Console):**
   ```
   Authentication → Users → Add User
   Email: approver2@blackswan.com
   Password: Temporary password
   ```

2. **Add to procurement_approvers table:**
   ```sql
   INSERT INTO public.procurement_approvers (
     user_id,
     role,
     approval_limit_clp,
     is_active
   ) VALUES (
     'USER_ID_FROM_AUTH', -- Copy from auth.users
     'approver',
     10000000, -- CLP 10M limit
     true
   );
   ```

### Promote to Admin

```sql
UPDATE public.procurement_approvers
SET role = 'admin', approval_limit_clp = NULL
WHERE user_id = 'USER_ID';
```

### Disable Approver

```sql
UPDATE public.procurement_approvers
SET is_active = false
WHERE user_id = 'USER_ID';
```

## Environment Variables Required

These should already be set in Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Testing Authentication

### Test 1: Login Works
1. Visit `/auth/login`
2. Enter `admin@blackswan.com` / `TemporaryPassword123!`
3. Should redirect to `/procurement/approvals`

### Test 2: Protected Routes
1. Visit `/procurement/approvals` (logged out)
2. Should redirect to `/auth/login`

### Test 3: Logout Works
1. Click "Logout" button in approvals page
2. Should redirect to `/auth/login`
3. Session cleared

### Test 4: Approver Role Check
1. Login as approver
2. Should see procurement requests
3. Should be able to approve/reject

### Test 5: Budget Limit
1. Login as approver (CLP 5M limit)
2. Try to approve request > CLP 5M
3. Should be rejected by `procurement_approval_limit_clp()` function

## Troubleshooting

### "Missing Supabase environment variables"
**Solution:** Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`

### "Approver role not found"
**Solution:** Ensure user ID is added to `procurement_approvers` table with `is_active = true`

### "Cannot login"
**Solution:** 
1. Verify user exists in Supabase Auth
2. Check password is correct
3. Verify email is confirmed

### "Redirect loop between login and approvals"
**Solution:** Check auth session in browser DevTools → Application → Cookies. Look for `sb-*` cookie.

## Next Steps

1. ✅ Run auth migration (`20260721_setup_auth_users.sql`)
2. ✅ Test login with demo credentials
3. ✅ Create additional approver accounts
4. ✅ Configure approval budget limits
5. ✅ Train approvers on the system
6. ✅ Enable procurement requests from users
7. ✅ Monitor audit logs for compliance

## Support

For issues or questions about authentication:
1. Check the Troubleshooting section above
2. Review Supabase documentation: https://supabase.com/docs/guides/auth
3. Check application logs in browser console
