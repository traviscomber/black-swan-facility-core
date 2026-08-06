insert into public.booking_action_permissions (
  role_key,
  action_key,
  allowed,
  requires_reason,
  requires_approval,
  is_critical,
  updated_at
)
select
  role_key,
  replace(action_key, '.manage', '.operate') as action_key,
  allowed,
  requires_reason,
  requires_approval,
  is_critical,
  now()
from public.booking_action_permissions
where action_key in (
  'activities.manage',
  'hospitality.manage',
  'housekeeping.manage',
  'maintenance.manage',
  'procurement.manage',
  'services.manage'
)
on conflict (role_key, action_key)
do update set
  allowed = excluded.allowed,
  requires_reason = excluded.requires_reason,
  requires_approval = excluded.requires_approval,
  is_critical = excluded.is_critical,
  updated_at = now();
