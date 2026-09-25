-- Raimundo's operational home is the finance approval queue.
-- Keep his existing role and permissions; this only corrects UX routing metadata.
update public.user_access_profiles p
set os_primary_domain = 'finance',
    os_start_path = '/budgets/approvals',
    updated_at = now()
from auth.users u
where p.user_id = u.id
  and lower(u.email) = 'raimundo@blackswn.org';
