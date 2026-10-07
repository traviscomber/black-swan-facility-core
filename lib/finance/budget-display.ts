export function financeDivisionLabel(name: string | null | undefined, sourceKey?: string | null) {
  if (!name) return 'P&L'
  if (sourceKey === 'hospitality-farm' || name === 'Farm') return 'Hospitality · Farm'
  if (sourceKey === 'hospitality-torobayo' || name === 'Torobayo') return 'Hospitality · Torobayo'
  return name
}

export function financeAllocationLabel(
  divisionName: string | null | undefined,
  categoryName: string | null | undefined,
  divisionSourceKey?: string | null,
) {
  const division = financeDivisionLabel(divisionName, divisionSourceKey)
  return categoryName ? `${division} · ${categoryName}` : division
}
