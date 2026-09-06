import type { ReactNode } from "react"

export default function TaskListLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-task-list-parity="true" className="contents">
    <style>{`
      @media (min-width: 768px) {
        [data-heirloom-task-list-parity="true"] main > main {
          max-width: none !important;
          padding: 0 40px 40px !important;
        }

        [data-heirloom-task-list-parity="true"] main > main > header {
          display: none !important;
        }

        [data-heirloom-task-list-parity="true"] main > main > nav[aria-label="Workload views"] {
          min-height: 44px !important;
          margin: 0 0 24px !important;
          padding: 0 !important;
          border-bottom: 1px solid #302f2b !important;
          gap: 0 !important;
        }

        [data-heirloom-task-list-parity="true"] main > main > nav[aria-label="Workload views"] a {
          min-height: 44px !important;
          padding: 0 14px !important;
          border-radius: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        [data-heirloom-task-list-parity="true"] main > main > section {
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        [data-heirloom-task-list-parity="true"] main > main input[placeholder*="Search"] {
          max-width: 210px !important;
          min-height: 40px !important;
          border-radius: 7px !important;
          background: #151513 !important;
        }

        [data-heirloom-task-list-parity="true"] main > main table {
          border-collapse: collapse !important;
        }

        [data-heirloom-task-list-parity="true"] main > main table th {
          height: 42px !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          color: #aaa69c !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }

        [data-heirloom-task-list-parity="true"] main > main table td {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
          border-top-color: #302f2b !important;
          font-size: 12px !important;
        }
      }
    `}</style>
    {children}
  </div>
}
