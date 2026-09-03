export default function Loading() {
  return (
    <div className="p-4 md:p-6" aria-hidden="true">
      <div className="mx-auto max-w-4xl animate-pulse space-y-5">
        <div className="h-7 w-56 bg-muted/60" />
        <div className="h-4 w-80 max-w-full bg-muted/40" />
        <div className="border-y py-4">
          <div className="h-4 w-40 bg-muted/50" />
          <div className="mt-2 h-3 w-24 bg-muted/30" />
        </div>
        <div className="space-y-px border-b">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 border-t bg-muted/10" />)}
        </div>
      </div>
    </div>
  )
}
