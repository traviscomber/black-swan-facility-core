'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle, AlertCircle, Download, Info } from 'lucide-react'

interface BudgetImportData {
  division: string
  divisionType: 'P&L' | 'PNL'
  responsible: string
  revenueTarget?: number
  categories: {
    name: string
    type: string
    monthlyAmount: number
    annualAmount: number
  }[]
}

interface ImportResult {
  success: boolean
  message: string
  divisionId?: string
  categoriesCreated?: number
}

const TEMPLATE_CSV = `Division,Type,Responsible,RevenueTarget,CategoryName,CategoryType,Monthly,Annual
Admin General,P&L,John Manager,50000,Salaries,Personnel,5000,60000
Admin General,P&L,John Manager,50000,Office Supplies,Operational,500,6000
Admin General,P&L,John Manager,50000,IT Services,Technology,1000,12000
Hospitality,P&L,Sarah Host,75000,Guest Services,Personnel,3000,36000
Hospitality,P&L,Sarah Host,75000,Linens & Laundry,Operational,800,9600
Landscaping,PNL,Miguel Garden,30000,Equipment Maintenance,Operational,1500,18000
Landscaping,PNL,Miguel Garden,30000,Plants & Seeds,Materials,2000,24000
Farming,PNL,Diego Farm,45000,Feed & Supplies,Materials,3000,36000
Farming,PNL,Diego Farm,45000,Equipment Repair,Operational,1500,18000`

export function BudgetUploadForm() {
  const { t } = useLanguage()
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importData, setImportData] = useState<BudgetImportData[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(true)

  // Download template CSV
  const downloadTemplate = () => {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE_CSV))
    element.setAttribute('download', 'Budget_Template.csv')
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Only CSV files are supported. Please export your Excel file as CSV and try again.')
      return
    }

    setFile(selectedFile)
    setError(null)
    setImportData([])
    setResults([])
    setPreviewMode(true)

    try {
      const text = await selectedFile.text()
      parseCSVData(text)
    } catch (err) {
      setError(`${t('common.error')}: ${err instanceof Error ? err.message : 'Failed to parse file'}`)
    }
  }

  const parseCSVData = (text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const parsedData: BudgetImportData[] = []
    const divisionMap = new Map<string, BudgetImportData>()

    // Find header line (usually first line, but skip empty lines)
    let headerIndex = 0
    const headerLine = lines[0]
    const isHeader = headerLine.toLowerCase().includes('division') || 
                     headerLine.toLowerCase().includes('type') ||
                     headerLine.toLowerCase().includes('category')

    // Skip header if found
    const startIndex = isHeader ? 1 : 0

    // Parse data lines
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      if (!line || line.startsWith('#')) continue // Skip empty lines and comments

      // Split carefully - handle quoted values
      const parts = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (parts.length < 5) continue // Need at least division, type, responsible, categoryName, categoryType

      const division = parts[0] || ''
      const type = parts[1]?.toUpperCase().includes('P&L') ? 'P&L' : 'PNL'
      const responsible = parts[2] || ''
      const revenueTarget = parts[3] ? parseFloat(parts[3]) : undefined
      const categoryName = parts[4] || ''
      const categoryType = parts[5] || 'Operational'
      const monthly = parts[6] ? parseFloat(parts[6]) : 0
      const annual = parts[7] ? parseFloat(parts[7]) : 0

      // Validate division name (skip percentage signs and invalid entries)
      if (!division || division === '0%' || division.startsWith('%') || !division.match(/[a-zA-Z]/)) {
        console.log('[v0] Skipping invalid division:', division)
        continue
      }

      if (!divisionMap.has(division)) {
        divisionMap.set(division, {
          division,
          divisionType: type,
          responsible,
          revenueTarget,
          categories: [],
        })
      }

      if (categoryName && categoryName !== 'CategoryName') {
        divisionMap.get(division)?.categories.push({
          name: categoryName,
          type: categoryType,
          monthlyAmount: monthly,
          annualAmount: annual,
        })
      }
    }

    if (divisionMap.size === 0) {
      throw new Error('No valid divisions found in CSV. Please check the format and try again.')
    }

    console.log('[v0] Parsed divisions:', Array.from(divisionMap.keys()))
    setImportData(Array.from(divisionMap.values()))
  }

  const handleImport = async () => {
    try {
      setUploading(true)
      setResults([])
      const importResults: ImportResult[] = []

      for (const divisionData of importData) {
        try {
          // Insert or update division
          const { data: division, error: divError } = await supabase
            .from('budget_divisions')
            .upsert(
              {
                name: divisionData.division,
                type: divisionData.divisionType,
                responsible_person: divisionData.responsible,
                revenue_target: divisionData.revenueTarget,
              },
              { onConflict: 'name' }
            )
            .select()

          if (divError) throw divError

          const divisionId = division?.[0]?.id

          // Insert categories
          let categoriesCreated = 0
          for (const category of divisionData.categories) {
            const { error: catError } = await supabase.from('budget_categories').insert({
              division_id: divisionId,
              name: category.name,
              type: category.type,
              monthly_amount: category.monthlyAmount,
              annual_amount: category.annualAmount,
            })

            if (!catError) categoriesCreated++
          }

          importResults.push({
            success: true,
            message: `Division "${divisionData.division}" imported successfully`,
            divisionId,
            categoriesCreated,
          })
        } catch (err) {
          importResults.push({
            success: false,
            message: `Failed to import "${divisionData.division}": ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      }

      setResults(importResults)
      setPreviewMode(false)

      // Reset form on success
      if (importResults.every(r => r.success)) {
        setTimeout(() => {
          setFile(null)
          setImportData([])
          setResults([])
        }, 2000)
      }
    } catch (err) {
      setError(`${t('common.error')}: ${err instanceof Error ? err.message : 'Import failed'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Info className="h-5 w-5" />
            How to Import Budget Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800">
          <ol className="space-y-2 list-decimal list-inside">
            <li>Download the CSV template below</li>
            <li>Open it in Excel and fill in your budget data</li>
            <li>Save the file as CSV (File → Save As → CSV format)</li>
            <li>Upload the CSV file here</li>
          </ol>
          <Button
            onClick={downloadTemplate}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-blue-400 text-blue-700 hover:bg-blue-100"
          >
            <Download className="h-4 w-4" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('budget.upload_excel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-gray-400" />
              <div>
                <p className="font-medium text-gray-700">Upload CSV File</p>
                <p className="text-sm text-gray-500">Drag and drop or click to select</p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute w-px h-px opacity-0 cursor-pointer"
                id="csv-input"
              />
              <label htmlFor="csv-input" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>Select CSV File</span>
                </Button>
              </label>
            </div>
            {file && <p className="text-sm text-green-600 mt-3">✓ {file.name}</p>}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Preview */}
          {previewMode && importData.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Preview ({importData.length} divisions)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {importData.map((division) => (
                  <div key={division.division} className="p-3 bg-gray-50 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{division.division}</span>
                      <Badge variant={division.divisionType === 'P&L' ? 'default' : 'secondary'}>
                        {division.divisionType}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {division.responsible && <>Responsible: {division.responsible}</>}
                    </p>
                    <div className="text-xs text-gray-600">
                      {division.categories.length} categories
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!previewMode && results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Import Results</h3>
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 p-3 rounded border ${
                    result.success
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <div className="font-medium">{result.message}</div>
                    {result.categoriesCreated && (
                      <div className="text-xs mt-1">({result.categoriesCreated} categories created)</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {previewMode && importData.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={uploading} className="flex-1">
                {uploading ? 'Importing...' : 'Import Data'}
              </Button>
              <Button
                onClick={() => {
                  setImportData([])
                  setFile(null)
                  setError(null)
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          )}

          {!previewMode && results.length > 0 && (
            <Button
              onClick={() => {
                setFile(null)
                setImportData([])
                setResults([])
                setPreviewMode(true)
              }}
              variant="outline"
              className="w-full"
            >
              Import Another File
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
