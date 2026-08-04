-- Restrict personal and communication data to the internal role model.
-- Current authorized operational roles are admin and approver.

-- Guests
DROP POLICY IF EXISTS "Authenticated users create guests" ON public.guests;
DROP POLICY IF EXISTS "Authenticated users read guests" ON public.guests;
DROP POLICY IF EXISTS "Authenticated users update guests" ON public.guests;

CREATE POLICY "guests_internal_insert"
ON public.guests
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "guests_internal_select"
ON public.guests
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "guests_internal_update"
ON public.guests
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
)
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

-- Volunteers
DROP POLICY IF EXISTS "volunteers_authenticated_insert" ON public.volunteers;
DROP POLICY IF EXISTS "volunteers_authenticated_select" ON public.volunteers;
DROP POLICY IF EXISTS "volunteers_authenticated_update" ON public.volunteers;

CREATE POLICY "volunteers_internal_insert"
ON public.volunteers
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "volunteers_internal_select"
ON public.volunteers
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "volunteers_internal_update"
ON public.volunteers
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
)
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

-- Leads
DROP POLICY IF EXISTS "Authenticated users create leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users read leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users update leads" ON public.leads;

CREATE POLICY "leads_internal_insert"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "leads_internal_select"
ON public.leads
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "leads_internal_update"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
)
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

-- Messages
DROP POLICY IF EXISTS "Authenticated users create messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users read messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users update messages" ON public.messages;

CREATE POLICY "messages_internal_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "messages_internal_select"
ON public.messages
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);

CREATE POLICY "messages_internal_update"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
)
WITH CHECK (
  COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = ANY (ARRAY['admin', 'approver'])
);
