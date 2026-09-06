import type { ReactNode } from "react"
import { GamePlanRouteFocus } from "@/components/orchard/game-plan-route-focus"

export default function GamePlanLayout({ children }:{ children:ReactNode }) {
  return <>
    <GamePlanRouteFocus/>
    {children}
  </>
}
