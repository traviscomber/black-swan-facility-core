import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function ActivitiesCalendarLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:px-6 space-y-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded-lg w-1/3" />
        <div className="h-6 bg-muted rounded-lg w-1/2" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="h-10 bg-muted rounded-lg w-20" />
        <div className="h-10 bg-muted rounded-lg w-24" />
        <div className="h-10 bg-muted rounded-lg w-24" />
        <div className="h-10 bg-muted rounded-lg w-24" />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="h-8 bg-muted rounded-lg w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
