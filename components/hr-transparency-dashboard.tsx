'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const hrApi = process.env.NEXT_PUBLIC_BLACK_SWAN_HR_API_URL

type Entity = { id: string; code: string; display_name: string }
type Person = { employee_id: string; name: string; photo_url: string | null; job_title: string | null; department_name: string | null; employment_type: string | null; is_primary: boolean; is_active: boolean }
type Department = { department_id: string; code: string; name: string; headcount: number }
type Report = { legal_entity_id: string; legal_entity_code: string; legal_entity_name: string; headcount: number; departments: Department[]; people: Person[]; generated_at: string }

async function callApi(path: string) {
  if (!hrApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_HR_API_URL is not configured')
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${hrApi}${path}`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'HR request failed')
  return body.data
}

export function HrTransparencyDashboard() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [entityId, setEntityId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void callApi('/v1/hr/entities').then((rows: Entity[]) => {
      setEntities(rows || [])
      const preferred = (rows || []).find((row) => row.code === 'BS_CORPORACION') || rows?.[0]
      if (preferred) setEntityId(preferred.id)
    }).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load HR entities'))
  }, [])

  useEffect(() => {
    if (!entityId) return
    void callApi(`/v1/hr/entities/${entityId}`).then((data: Report) => {
      setReport(data)
      setError(null)
    }).catch((e) => {
      setReport(null)
      setError(e instanceof Error ? e.message : 'Unable to load HR transparency')
    })
  }, [entityId])

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>HR Transparency</CardTitle>
          <CardDescription>Read-only organization and headcount view. Private HR, payroll, compensation and direct contact information are excluded.</CardDescription>
        </CardHeader>
        <CardContent>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            <option value="">Select legal entity</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.display_name}</option>)}
          </select>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardDescription>Legal Entity</CardDescription><CardTitle>{report.legal_entity_name}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Active Headcount</CardDescription><CardTitle>{report.headcount}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Departments</CardDescription><CardTitle>{report.departments.length}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {report.departments.map((department) => (
                <div key={department.department_id} className="rounded-lg border p-4">
                  <div className="font-medium">{department.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{department.headcount} people</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>People</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {report.people.length === 0 && <p className="text-sm text-muted-foreground">No canonical employee assignments available yet.</p>}
              {report.people.map((person) => (
                <div key={person.employee_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <div className="font-medium">{person.name}</div>
                    <div className="text-sm text-muted-foreground">{person.job_title || 'Role not assigned'} · {person.department_name || 'No department'}</div>
                  </div>
                  <div className="flex gap-2">
                    {person.is_primary && <Badge variant="outline">Primary</Badge>}
                    {person.employment_type && <Badge variant="outline">{person.employment_type}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
