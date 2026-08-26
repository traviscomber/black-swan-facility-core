"use client"

interface Category {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  parent_category_id?: string | null
}

interface CategorySelectorProps {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
}

export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  const hasHierarchy = categories.some((category) => Boolean(category.parent_category_id))

  if (!hasHierarchy) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-input px-3 py-2"
      >
        <option value="">Select a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
    )
  }

  const parentCategories = categories.filter((category) => !category.parent_category_id)
  const categoryMap = new Map<string | null, Category[]>()

  categories.forEach((category) => {
    const parentId = category.parent_category_id || null
    const siblings = categoryMap.get(parentId) ?? []
    siblings.push(category)
    categoryMap.set(parentId, siblings)
  })

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border bg-input px-3 py-2"
    >
      <option value="">Select a category</option>
      {parentCategories.map((parent) => {
        const children = categoryMap.get(parent.id) ?? []
        if (children.length === 0) {
          return <option key={parent.id} value={parent.id}>{parent.name}</option>
        }
        return (
          <optgroup key={parent.id} label={parent.name}>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
