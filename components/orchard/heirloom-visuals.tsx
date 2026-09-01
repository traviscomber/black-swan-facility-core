import type { ReactNode } from "react"

export function OrchardPhotoHero({eyebrow,title,description,image,children}:{eyebrow:string;title:string;description:string;image:string;children?:ReactNode}){
  return <section className="relative isolate min-h-[390px] overflow-hidden border border-white/10 bg-neutral-950 text-white sm:min-h-[460px]">
    <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,10,8,.95)_0%,rgba(6,10,8,.78)_46%,rgba(6,10,8,.16)_100%),linear-gradient(0deg,rgba(6,10,8,.72)_0%,transparent_55%)]" />
    <div className="relative flex min-h-[390px] max-w-4xl flex-col justify-end p-6 sm:min-h-[460px] sm:p-10 lg:p-12">
      <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-emerald-200/80">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-.045em] text-white sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">{description}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  </section>
}

export function OrchardMetricStrip({items}:{items:Array<{label:string;value:string;detail?:string}>}){
  return <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
    {items.map((item)=><div key={item.label} className="bg-[rgba(7,12,9,.78)] p-4 backdrop-blur-sm sm:p-5">
      <p className="text-[10px] uppercase tracking-[.16em] text-white/48">{item.label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums text-white">{item.value}</p>
      {item.detail?<p className="mt-1 text-xs text-white/50">{item.detail}</p>:null}
    </div>)}
  </div>
}

export function OrchardStageRail({stages}:{stages:Array<{label:string;date?:string|null;active?:boolean;complete?:boolean}>}){
  return <div className="grid gap-2 sm:grid-cols-3">
    {stages.map((stage,index)=><div key={`${stage.label}-${index}`} className={`relative min-h-24 border p-4 ${stage.active?"border-emerald-400/50 bg-emerald-400/8":"border-border bg-card"}`}>
      <div className="mb-5 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stage.complete?"bg-emerald-400":stage.active?"bg-amber-300":"bg-muted-foreground/30"}`}/><span className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">{String(index+1).padStart(2,"0")}</span></div>
      <p className="font-medium">{stage.label}</p>
      {stage.date?<p className="mt-1 text-xs text-muted-foreground">{stage.date}</p>:null}
    </div>)}
  </div>
}

export function OrchardCropTile({name,meta,image,badge,footer}:{name:string;meta?:string;image:string;badge?:string;footer?:ReactNode}){
  return <article className="group overflow-hidden border bg-background">
    <div className="relative h-44 overflow-hidden bg-muted">
      <img src={image} alt={name} className="h-full w-full object-cover opacity-100 transition duration-500 [filter:none] group-hover:scale-[1.025]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_32%,rgba(0,0,0,.78)_100%)]" />
      {badge?<span className="absolute right-3 top-3 border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-white backdrop-blur-sm">{badge}</span>:null}
      <div className="absolute inset-x-4 bottom-4 text-white"><h3 className="text-xl font-medium tracking-[-.02em] text-white!">{name}</h3>{meta?<p className="mt-1 text-xs text-white/65">{meta}</p>:null}</div>
    </div>
    {footer?<div className="p-4">{footer}</div>:null}
  </article>
}

export function OrchardBedVisual({name,status,occupancy,crop,image}:{name:string;status:string;occupancy:string;crop?:string|null;image?:string}){
  return <div className="relative min-h-36 overflow-hidden border bg-[#111713]">
    {image?<img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 [filter:none]"/>:null}
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,11,8,.94),rgba(7,11,8,.58))]"/>
    <div className="relative flex h-full min-h-36 flex-col justify-between p-4 text-white">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.16em] text-white/45">{status}</p><h3 className="mt-1 text-lg font-medium text-white!">{name}</h3></div><span className="border border-white/15 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[.12em] text-white/75">{occupancy}</span></div>
      {crop?<p className="mt-6 text-sm text-emerald-100">{crop}</p>:<p className="mt-6 text-sm text-white/45">Open bed</p>}
    </div>
  </div>
}
