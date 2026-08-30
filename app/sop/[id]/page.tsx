import { notFound } from "next/navigation"
import { SopDetailView, type SopProcedureDetail } from "@/components/sop-views"
import { createClient } from "@/lib/supabase/server"

export default async function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sop_procedures")
    .select("id, code, title, domain, owner_role, description, status, risk_level, sop_versions(id, version_number, status, objective, scope, acceptance_criteria, estimated_minutes, sop_steps(id, step_number, title, instruction, is_required, requires_evidence, evidence_type, requires_approval, expected_minutes, safety_notes))")
    .eq("id", id)
    .single()

  if (error || !data) notFound()
  return <SopDetailView procedure={data as SopProcedureDetail} />
}
