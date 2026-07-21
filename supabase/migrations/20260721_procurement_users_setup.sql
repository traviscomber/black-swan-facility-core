-- Procurement Users Setup Migration
-- This migration creates the database support for the three procurement users
-- Users are created via the /admin/procurement-users page using Supabase Admin API

-- Create procurement_approvers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.procurement_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'approver')),
  approval_limit_clp BIGINT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit log table for approval decisions
CREATE TABLE IF NOT EXISTS public.approver_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approver_id UUID NOT NULL REFERENCES public.procurement_approvers(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  procurement_request_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on procurement_approvers
ALTER TABLE public.procurement_approvers ENABLE ROW LEVEL SECURITY;

-- Approvers can view their own record
CREATE POLICY "approvers_view_self" ON public.procurement_approvers
  FOR SELECT USING (user_id = auth.uid());

-- Admin users can view all approvers
CREATE POLICY "approvers_view_all_if_admin" ON public.procurement_approvers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.procurement_approvers pa
      WHERE pa.user_id = auth.uid() AND pa.role = 'admin'
    )
  );

-- Enable RLS on audit log
ALTER TABLE public.approver_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow viewing own audit actions
CREATE POLICY "audit_view_self" ON public.approver_audit_log
  FOR SELECT USING (
    approver_id IN (
      SELECT id FROM public.procurement_approvers WHERE user_id = auth.uid()
    )
  );

-- Create function to check if user is procurement approver
CREATE OR REPLACE FUNCTION public.is_procurement_approver()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM public.procurement_approvers
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create function to get approval limit
CREATE OR REPLACE FUNCTION public.get_procurement_approval_limit_clp()
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT 
      CASE 
        WHEN role = 'admin' THEN NULL -- unlimited
        ELSE approval_limit_clp
      END
    FROM public.procurement_approvers
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_procurement_approvers_user_id 
ON public.procurement_approvers(user_id);

CREATE INDEX IF NOT EXISTS idx_procurement_approvers_role 
ON public.procurement_approvers(role);

CREATE INDEX IF NOT EXISTS idx_approver_audit_log_approver_id 
ON public.approver_audit_log(approver_id);

CREATE INDEX IF NOT EXISTS idx_approver_audit_log_created_at 
ON public.approver_audit_log(created_at DESC);

-- Grant permissions
GRANT SELECT ON public.procurement_approvers TO authenticated;
GRANT SELECT ON public.approver_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_procurement_approver() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_procurement_approval_limit_clp() TO authenticated;
