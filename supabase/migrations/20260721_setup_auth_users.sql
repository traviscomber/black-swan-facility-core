-- Create procurement approvers table to track who can approve
CREATE TABLE IF NOT EXISTS public.procurement_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'approver', -- approver, admin
  approval_limit_clp DECIMAL(18,2) DEFAULT NULL, -- NULL = unlimited (admin)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create approver audit log
CREATE TABLE IF NOT EXISTS public.approver_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approver_id UUID NOT NULL REFERENCES public.procurement_approvers(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- login, logout, approval, rejection
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on procurement_approvers
ALTER TABLE public.procurement_approvers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own record
CREATE POLICY "Approvers can view own record"
ON public.procurement_approvers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all
CREATE POLICY "Admins can view all approvers"
ON public.procurement_approvers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.procurement_approvers
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Enable RLS on approver_audit_log
ALTER TABLE public.approver_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only approvers can view audit logs
CREATE POLICY "Approvers can view audit logs"
ON public.approver_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.procurement_approvers
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Insert demo approver accounts (update these emails)
-- Password will be set via Supabase Auth UI
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'admin@blackswan.com',
    NOW(),
    crypt('TemporaryPassword123!', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'approver@blackswan.com',
    NOW(),
    crypt('TemporaryPassword123!', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"role":"approver"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'approver2@blackswan.com',
    NOW(),
    crypt('TemporaryPassword123!', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"role":"approver"}',
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Insert corresponding procurement_approvers records
INSERT INTO public.procurement_approvers (user_id, role, approval_limit_clp, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin', NULL, true),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'approver', 5000000, true),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'approver', 10000000, true)
ON CONFLICT (user_id) DO NOTHING;

-- Create function to log approver actions
CREATE OR REPLACE FUNCTION log_approver_action(
  p_action TEXT,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_approver_id UUID;
BEGIN
  SELECT id INTO v_approver_id
  FROM public.procurement_approvers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_approver_id IS NOT NULL THEN
    INSERT INTO public.approver_audit_log (
      approver_id,
      action,
      details,
      ip_address,
      user_agent
    ) VALUES (
      v_approver_id,
      p_action,
      p_details,
      p_ip_address,
      p_user_agent
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the is_procurement_approver function
CREATE OR REPLACE FUNCTION is_procurement_approver()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.procurement_approvers
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
