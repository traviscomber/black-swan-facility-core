'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react'

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

export function BudgetUploadForm() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importData, setImportData] = useState<BudgetImportData[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setImportData([])
    setResults([])

    try {
      // Handle both CSV and XLSX files
      if (selectedFile.name.endsWith('.csv')) {
        // CSV parsing
        const text = await selectedFile.text()
        parseCSVData(text)
      } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        // XLSX parsing using dynamic import
        const buffer = await selectedFile.arrayBuffer()
        await parseXLSXData(buffer)
      } else {
        throw new Error('Unsupported file format. Please use CSV or XLSX.')
      }
    } catch (err) {
      setError(`${t('common.error')}: ${err instanceof Error ? err.message : 'Failed to parse file'}`)
    }
  }

  const parseCSVData = (text: string) => {
    const lines = text.split('\n')
    const parsedData: BudgetImportData[] = []
    const divisionMap = new Map<string, BudgetImportData>()

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const [division, type, responsible, revenueTarget, categoryName, categoryType, monthly, annual] = line
        .split(',')
        .map(v => v.trim())

      if (!division) continue

      if (!divisionMap.has(division)) {
        divisionMap.set(division, {
          division,
          divisionType: (type as 'P&L' | 'PNL') || 'PNL',
          responsible: responsible || '',
          revenueTarget: parseFloat(revenueTarget) || undefined,
          categories: [],
        })
      }

      if (categoryName) {
        divisionMap.get(division)?.categories.push({
          name: categoryName,
          type: categoryType || 'Operational',
          monthlyAmount: parseFloat(monthly) || 0,
          annualAmount: parseFloat(annual) || 0,
        })
      }
    }

    setImportData(Array.from(divisionMap.values()))
  }

  const parseXLSXData = async (buffer: ArrayBuffer) => {
    try {
      // For XLSX files, we'll use a simple workaround:
      // Convert the buffer to a blob and read it as text
      // This works for simple XLSX files that are mostly CSV-like
      const blob = new Blob([buffer])
      const text = await blob.text()
      
      // Try to extract CSV-like data from the XLSX/XML content
      // Look for data between XML tags
      const regex = /<t>([^<]*)<\/t>/g
      const matches: string[] = []
      let match
      
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[1])
      }

      if (matches.length === 0) {
        // Fallback: try to parse as CSV if it's already in that format
        parseCSVData(text)
        return
      }

      // Reconstruct CSV from extracted data
      const divisionMap = new Map<string, BudgetImportData>()
      
      // Group data into rows (typically Excel has consistent column count)
      const columnCount = 8 // Division, Type, Responsible, RevenueTarget, CategoryName, CategoryType, Monthly, Annual
      
      for (let i = 0; i < matches.length; i += columnCount) {
        const division = matches[i]?.trim() || ''
        const type = matches[i + 1]?.trim() || 'PNL'
        const responsible = matches[i + 2]?.trim() || ''
        const revenueTarget = matches[i + 3]?.trim() || ''
        const categoryName = matches[i + 4]?.trim() || ''
        const categoryType = matches[i + 5]?.trim() || 'Operational'
        const monthly = matches[i + 6]?.trim() || '0'
        const annual = matches[i + 7]?.trim() || '0'

        if (!division || division.toLowerCase() === 'division') continue // Skip headers

        if (!divisionMap.has(division)) {
          divisionMap.set(division, {
            division,
            divisionType: (type as 'P&L' | 'PNL') || 'PNL',
            responsible,
            revenueTarget: parseFloat(revenueTarget) || undefined,
            categories: [],
          })
        }

        if (categoryName) {
          divisionMap.get(division)?.categories.push({
            name: categoryName,
            type: categoryType,
            monthlyAmount: parseFloat(monthly) || 0,
            annualAmount: parseFloat(annual) || 0,
          })
        }
      }

      if (divisionMap.size === 0) {
        throw new Error('No valid data found in Excel file. Please ensure your file has the correct structure.')
      }

      setImportData(Array.from(divisionMap.values()))
    } catch (err) {
      setError(
        `${t('common.error')}: ${err instanceof Error ? err.message : 'Failed to parse Excel file. Please convert to CSV format and try again.'}`
      )
    }
  }

  const importBudgetData = async () => {
    if (importData.length === 0) {
      setError('No data to import')
      return
    }

    setUploading(true)
    setResults([])

    try {
      const supabase = createClient()
      const importResults: ImportResult[] = []

      for (const data of importData) {
        try {
          // Check if division already exists
          const { data: existingDivision } = await supabase
            .from('budget_divisions')
            .select('id')
            .eq('name', data.division)
            .single()

          let divisionId: string
          if (existingDivision) {
            divisionId = existingDivision.id
          } else {
            // Create new division
            const { data: newDivision, error: divisionError } = await supabase
              .from('budget_divisions')
              .insert({
                name: data.division,
                type: data.divisionType,
                total_budget: data.categories.reduce((sum, c) => sum + c.annualAmount, 0),
                annual_budget: data.categories.reduce((sum, c) => sum + c.annualAmount, 0),
                revenue_target: data.revenueTarget,
                responsible: data.responsible,
              })
              .select()
              .single()

            if (divisionError) throw divisionError
            divisionId = newDivision.id
          }

          // Add or update categories
          let categoriesCreated = 0
          for (const category of data.categories) {
            const { error: categoryError } = await supabase
              .from('budget_categories')
              .upsert({
                division_id: divisionId,
                name: category.name,
                category_type: category.type,
                monthly_amount: category.monthlyAmount,
                annual_amount: category.annualAmount,
              })

            if (!categoryError) categoriesCreated++
          }

          importResults.push({
            success: true,
            message: `${t('common.success')}: ${data.division}`,
            divisionId,
            categoriesCreated,
          })
        } catch (err) {
          importResults.push({
            success: false,
            message: `${t('common.error')}: ${data.division} - ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      }

      setResults(importResults)
    } catch (err) {
      setError(`${t('common.error')}: ${err instanceof Error ? err.message : 'Import failed'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('budget.import_data')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="budget-file"
            />
            <label htmlFor="budget-file" className="cursor-pointer block text-center">
              <div className="text-lg font-semibold">{t('budget.upload_excel')}</div>
              <p className="text-sm text-gray-600 mt-2">
                CSV or Excel format: Division, Type, Responsible, RevenueTarget, CategoryName, CategoryType, Monthly, Annual
              </p>
              {file && <p className="text-sm font-medium text-green-600 mt-2">{file.name}</p>}
            </label>
          </div>

          {/* Preview Data */}
          {importData.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">{t('common.preview')}:</h3>
              {importData.map((data, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{data.division}</h4>
                      <p className="text-sm text-gray-600">{data.responsible}</p>
                    </div>
                    <Badge>{data.divisionType}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">{t('budget.annual_budget')}:</span>
                      <p className="font-semibold">
                        ${data.categories.reduce((sum, c) => sum + c.annualAmount, 0).toLocaleString()}
                      </p>
                    </div>
                    {data.revenueTarget && (
                      <div>
                        <span className="text-gray-600">{t('budget.revenue_target')}:</span>
                        <p className="font-semibold">${data.revenueTarget.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-sm font-medium mb-2">{t('budget.categories')}:</p>
                    <ul className="text-sm space-y-1">
                      {data.categories.map((cat, cidx) => (
                        <li key={cidx}>
                          {cat.name} ({cat.type}) - ${cat.annualAmount.toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Import Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">{t('common.results')}:</h3>
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-3 rounded-lg ${
                    result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.message}
                    </p>
                    {result.categoriesCreated && (
                      <p className="text-xs text-gray-600 mt-1">
                        {result.categoriesCreated} {t('budget.categories')} created
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={importBudgetData}
            disabled={importData.length === 0 || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                {t('common.loading')}...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {t('budget.import_data')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
