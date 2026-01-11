"use client"

interface Category {
  id: string
  name: string
  icon?: string
  color?: string
  parent_category_id?: string | null
}

interface CategorySelectorProps {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
}

export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  // Group categories by parent
  const parentCategories = categories.filter((c) => !c.parent_category_id)
  const categoryMap = new Map<string | null, Category[]>()

  categories.forEach((cat) => {
    const parentId = cat.parent_category_id || null
    if (!categoryMap.has(parentId)) {
      categoryMap.set(parentId, [])
    }
    categoryMap.get(parentId)?.push(cat)
  })

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-input border border-border rounded-md"
    >
      <option value="">Select a category</option>
      {parentCategories.map((parent) => (
        <optgroup key={parent.id} label={parent.name}>
          {categoryMap
            .get(parent.id)
            ?.filter((c) => c.id !== parent.id)
            .map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
        </optgroup>
      ))}
      {/* Add non-grouped categories */}
      {categories
        .filter((c) => !c.parent_category_id && !parentCategories.some((p) => p.id === c.id))
        .map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
    </select>
  )
}
