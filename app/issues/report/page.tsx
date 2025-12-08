"use client"

import type React from "react"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface Asset {
  id: string
  name: string
  type: string
}

interface Infrastructure {
  id: string
  name: string
  category: string
  status: string
  description: string | null
  locations?: { name: string } | null
}

interface Employee {
  id: string
  name: string
  role: string | null
}

interface IssueCategory {
  id: string
  name: string
  description: string | null
}

export default function ReportIssuePage() {
  const router = useRouter()

  // Form data
  const [issueCategories, setIssueCategories] = useState<IssueCategory[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [infrastructure, setInfrastructure] = useState<Infrastructure[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Form fields
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [relatedItemType, setRelatedItemType] = useState("")
  const [relatedItemId, setRelatedItemId] = useState("")
  const [assetId, setAssetId] = useState("")
  const [reportedBy, setReportedBy] = useState("")

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      const [categoriesRes, assetsRes, infraRes, employeesRes] = await Promise.all([
        supabase.from("issue_categories").select("*").eq("is_active", true).order("name"),
        supabase.from("assets").select("*").order("name"),
        supabase.from("infrastructure_plans").select("*, locations(name)").order("name"),
        supabase.from("employees").select("*").eq("is_active", true).order("name"),
      ])

      if (categoriesRes.data) setIssueCategories(categoriesRes.data)
      if (assetsRes.data) setAssets(assetsRes.data)
      if (infraRes.data) setInfrastructure(infraRes.data)
      if (employeesRes.data) setEmployees(employeesRes.data)
    }

    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!title.trim()) {
      setError("Please enter an issue title")
      return
    }

    if (!category) {
      setError("Please select an issue category")
      return
    }

    if (!description.trim()) {
      setError("Please provide a description")
      return
    }

    if (!relatedItemType || !relatedItemId) {
      setError("Please select either an infrastructure item or asset")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const issueData = {
        title: title.trim(),
        category,
        description: description.trim(),
        priority,
        status: "open",
        related_item_type: relatedItemType,
        related_item_id: relatedItemId,
        asset_id: relatedItemType === "asset" ? relatedItemId : assetId || null,
        reported_by: reportedBy || null,
        photo_url: null,
      }

      console.log("[v0] Submitting issue:", issueData)

      const { data, error: insertError } = await supabase.from("issues").insert(issueData).select().single()

      if (insertError) {
        console.error("[v0] Error creating issue:", insertError)
        throw insertError
      }

      console.log("[v0] Issue created successfully:", data)

      // Success!
      setSuccess(true)

      // Reset form
      setTitle("")
      setCategory("")
      setDescription("")
      setPriority("medium")
      setRelatedItemType("")
      setRelatedItemId("")
      setAssetId("")
      setReportedBy("")

      // Navigate after short delay
      setTimeout(() => {
        router.push("/issues")
        router.refresh()
      }, 1500)
    } catch (err: any) {
      console.error("[v0] Submit error:", err)
      setError(err.message || "Failed to submit issue")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader title="Report Issue" description="Submit a new facility or infrastructure issue" />

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Issue Details</CardTitle>
              <CardDescription>Provide information about the issue you're reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Issue Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Issue Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of the issue"
                    required
                  />
                </div>

                {/* Issue Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Issue Category *</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {category && (
                    <p className="text-xs text-muted-foreground">
                      {issueCategories.find((c) => c.id === category)?.description}
                    </p>
                  )}
                </div>

                {/* Related Item Type */}
                <div className="space-y-2">
                  <Label htmlFor="item-type">Related To *</Label>
                  <Select
                    value={relatedItemType}
                    onValueChange={(val) => {
                      setRelatedItemType(val)
                      setRelatedItemId("")
                    }}
                    required
                  >
                    <SelectTrigger id="item-type">
                      <SelectValue placeholder="Select item type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="asset">Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Infrastructure Selection */}
                {relatedItemType === "infrastructure" && (
                  <div className="space-y-2">
                    <Label htmlFor="infrastructure">Infrastructure Item *</Label>
                    <Select value={relatedItemId} onValueChange={setRelatedItemId} required>
                      <SelectTrigger id="infrastructure">
                        <SelectValue placeholder="Select infrastructure" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {infrastructure.map((infra) => (
                          <SelectItem key={infra.id} value={infra.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{infra.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {infra.category} • {infra.status}
                                {infra.locations && ` • ${infra.locations.name}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Asset Selection */}
                {relatedItemType === "asset" && (
                  <div className="space-y-2">
                    <Label htmlFor="asset-select">Asset *</Label>
                    <Select
                      value={relatedItemId}
                      onValueChange={(val) => {
                        setRelatedItemId(val)
                        setAssetId(val)
                      }}
                      required
                    >
                      <SelectTrigger id="asset-select">
                        <SelectValue placeholder="Select asset" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name} ({asset.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional Asset (Optional) - Only show when infrastructure is selected */}
                {relatedItemType === "infrastructure" && (
                  <div className="space-y-2">
                    <Label htmlFor="asset">Associated Asset (Optional)</Label>
                    <Select value={assetId} onValueChange={setAssetId}>
                      <SelectTrigger id="asset">
                        <SelectValue placeholder="Select asset if applicable" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name} ({asset.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={setPriority} required>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue in detail..."
                    rows={5}
                    required
                  />
                </div>

                {/* Reported By */}
                <div className="space-y-2">
                  <Label htmlFor="reporter">Reported By</Label>
                  <Select value={reportedBy} onValueChange={setReportedBy}>
                    <SelectTrigger id="reporter">
                      <SelectValue placeholder="Select reporter" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} {emp.role && `(${emp.role})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Issue submitted successfully! Redirecting...</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting || success}>
                    {isSubmitting ? "Submitting..." : success ? "Submitted!" : "Submit Issue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
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
