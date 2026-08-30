import { Skeleton } from "@/components/ui/skeleton"

export default function OrchardLibraryLoading(){
  return <div className="space-y-6 p-3 pb-24 sm:p-8">
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <Skeleton className="h-[280px] rounded-2xl"/>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {Array.from({length:4}).map((_,i)=><Skeleton key={i} className="min-h-[62px] rounded-xl"/>)}
      </div>
    </div>
    <div className="space-y-4">
      <div className="flex gap-2 overflow-hidden py-3">
        {Array.from({length:14}).map((_,i)=><Skeleton key={i} className="h-9 w-9 shrink-0 rounded-md"/>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({length:6}).map((_,i)=><div key={i} className="overflow-hidden rounded-xl border border-white/10"><Skeleton className="h-[210px] rounded-none"/><div className="space-y-3 p-4"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-4/5"/></div></div>)}
      </div>
    </div>
  </div>
}
