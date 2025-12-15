import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"

interface InfoGuideProps {
  title: string
  description: string
  steps?: { number: number; text: string }[]
  className?: string
}

export function InfoGuide({ title, description, steps, className }: InfoGuideProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 md:p-6 space-y-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <HelpCircle className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-blue-900">{title}</h3>
          <p className="text-sm text-blue-800 mt-1">{description}</p>
        </div>
      </div>

      {steps && steps.length > 0 && (
        <div className="pt-2 border-t border-blue-200">
          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.number} className="flex gap-3 text-sm text-blue-900">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                  {step.number}
                </span>
                <span className="pt-0.5">{step.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
