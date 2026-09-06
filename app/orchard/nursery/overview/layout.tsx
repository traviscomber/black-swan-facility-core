import type { ReactNode } from "react"

export default function NurseryOverviewLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-nursery-parity="true" className="contents">
    <style>{`
      @media (min-width: 1024px) {
        [data-heirloom-nursery-parity="true"] main > main {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 300px !important;
          column-gap: 20px !important;
          row-gap: 16px !important;
          max-width: none !important;
          padding: 18px 24px 36px !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > header,
        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(1) {
          display: none !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(4) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          margin: 0 !important;
          align-self: start !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(3) {
          grid-column: 2 !important;
          grid-row: 1 / span 2 !important;
          margin: 0 !important;
          align-self: start !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(2) {
          grid-column: 1 !important;
          grid-row: 2 !important;
          margin: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(5) {
          grid-column: 1 / -1 !important;
          grid-row: 3 !important;
          margin: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > footer {
          grid-column: 1 / -1 !important;
          grid-row: 4 !important;
          margin-top: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main section {
          border-color: #302f2b !important;
          background: #11110f !important;
          box-shadow: none !important;
        }

        [data-heirloom-nursery-parity="true"] main > main table th,
        [data-heirloom-nursery-parity="true"] main > main table td {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
        }

        [data-heirloom-nursery-parity="true"] main > main input {
          border-radius: 6px !important;
          background: #151513 !important;
        }
      }
    `}</style>
    {children}
  </div>
}
