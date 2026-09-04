import type { ReactNode } from "react"
import { CurrentWeekFocus } from "./current-week-focus"

export default function SeasonLayout({ children }:{ children:ReactNode }) {
  return <><CurrentWeekFocus/>{children}</>
}
