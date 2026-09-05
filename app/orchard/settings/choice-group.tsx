"use client"

export function ChoiceGroup({
  title,
  name,
  value,
  options,
  onChange,
}: {
  title: string
  name: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-lg font-normal">{title}</legend>
      <div className="border-y border-[var(--bs-divider-subtle)] py-3">
        {options.map(([key, label]) => (
          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
