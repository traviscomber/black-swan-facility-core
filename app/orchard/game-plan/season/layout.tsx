import type { ReactNode } from "react"
import { CurrentWeekFocus } from "./current-week-focus"

export default function SeasonLayout({ children }:{ children:ReactNode }) {
  return <div data-season-schedule-parity="true" className="contents">
    <CurrentWeekFocus/>
    <style>{`
      @media (min-width: 768px) {
        [data-season-schedule-parity="true"] main {
          padding-bottom: 28px !important;
        }

        [data-season-schedule-parity="true"] main > header {
          display: none !important;
        }

        [data-season-schedule-parity="true"] main > header + section {
          padding: 10px 12px !important;
          background: #11110f !important;
          border-bottom-color: #302f2b !important;
        }

        [data-season-schedule-parity="true"] main > header + section > div:first-child {
          align-items: center !important;
          gap: 10px !important;
        }

        [data-season-schedule-parity="true"] main > header + section label {
          min-height: 36px !important;
          max-width: 240px !important;
          border-radius: 6px !important;
          border-color: #34322d !important;
          background: #171614 !important;
        }

        [data-season-schedule-parity="true"] main > header + section label input {
          font-size: 12px !important;
        }

        [data-season-schedule-parity="true"] main > header + section > div:last-child {
          margin-top: 6px !important;
          gap: 12px !important;
          color: #8f8a81 !important;
          font-size: 10px !important;
        }

        [data-season-schedule-parity="true"] main > section:nth-of-type(2) {
          padding-top: 0 !important;
        }

        [data-season-schedule-parity="true"] details[data-orchard-season-crop] > summary {
          min-height: 42px !important;
          padding-top: 6px !important;
          padding-bottom: 6px !important;
        }

        [data-season-schedule-parity="true"] details[data-orchard-season-crop] [data-season-succession-row] {
          min-height: 34px !important;
        }
      }
    `}</style>
    {children}
  </div>
}
