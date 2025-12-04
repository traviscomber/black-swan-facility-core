"use client"

import type React from "react"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import type { Asset, Employee } from "@/lib/types"
import { useMobile } from "@/hooks/use-mobile"

export default function ReportIssuePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAssetId = searchParams.get("asset")
  const isMobile = useMobile()

  const [assets, setAssets] = useState<Asset[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedAsset, setSelectedAsset] = useState(preselectedAssetId || "")
  const [reportedBy, setReportedBy] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const { data: assetsData } = await supabase.from("assets").select("*").order("name")

      const { data: employeesData } = await supabase.from("employees").select("*").eq("is_active", true).order("name")

      if (assetsData) setAssets(assetsData)
      if (employeesData) setEmployees(employeesData)
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()

    const { error: insertError } = await supabase.from("issues").insert({
      asset_id: selectedAsset || null,
      reported_by: reportedBy || null,
      description,
      status: "open",
    })

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
      return
    }

    router.push("/issues")
  }

  return (
    <AppLayout>
      <PageHeader title="Report Issue" description="Submit a new facility issue" />

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Issue Details</CardTitle>
              <CardDescription>Provide information about the issue you're reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8 md:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="asset">Asset</Label>
                  {isMobile ? (
                    <select
                      id="asset"
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger id="asset" className="w-full">
                        <SelectValue placeholder="Select an asset" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name} ({asset.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reporter">Reported By</Label>
                  {isMobile ? (
                    <select
                      id="reporter"
                      value={reportedBy}
                      onChange={(e) => setReportedBy(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select reporter</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} {employee.role && `(${employee.role})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Select value={reportedBy} onValueChange={setReportedBy}>
                      <SelectTrigger id="reporter" className="w-full">
                        <SelectValue placeholder="Select reporter" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name} {employee.role && `(${employee.role})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? "Submitting..." : "Submit Issue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
