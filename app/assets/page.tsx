import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import type { Asset } from "@/lib/types"
import Link from "next/link"
import { Plus, QrCode } from "lucide-react"

export default async function AssetsPage() {
  const supabase = await createClient()

  const { data: assets } = await supabase.from("assets").select("*").order("name")

  return (
    <AppLayout>
      <PageHeader
        title="Assets"
        description="Manage facility infrastructure and equipment"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        }
      />

      <div className="p-8">
        <div className="rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>QR</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets && assets.length > 0 ? (
                assets.map((asset: Asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <Link href={`/assets/${asset.id}`} className="text-blue-600 hover:text-blue-800">
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell>{asset.type}</TableCell>
                    <TableCell>{asset.location || "-"}</TableCell>
                    <TableCell>
                      {asset.is_critical ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Critical
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">
                          Normal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{asset.is_critical && <QrCode className="h-4 w-4 text-gray-600" />}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/assets/${asset.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No assets found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  )
}
