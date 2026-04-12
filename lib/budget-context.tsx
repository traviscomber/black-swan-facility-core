import { createContext, useContext, useState, ReactNode } from 'react'

interface BudgetContextType {
  selectedDivision: string | null
  setSelectedDivision: (divisionId: string | null) => void
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)

  return (
    <BudgetContext.Provider value={{ selectedDivision, setSelectedDivision }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudgetDivision() {
  const context = useContext(BudgetContext)
  if (context === undefined) {
    throw new Error('useBudgetDivision must be used within BudgetProvider')
  }
  return context
}
