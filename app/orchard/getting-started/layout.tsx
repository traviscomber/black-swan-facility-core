import type { ReactNode } from "react"

export default function GettingStartedParityLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-getting-started-parity="true" className="contents">
    <style>{`
      @media (min-width: 1024px) {
        [data-heirloom-getting-started-parity="true"] main > main {
          display: grid !important;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr) !important;
          gap: 0 !important;
          max-width: 1040px !important;
          padding-top: 16px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          min-height: 292px !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: stretch !important;
          padding: 34px 38px !important;
          border: 1px solid var(--orchard-line) !important;
          border-right: 0 !important;
          border-radius: 14px 0 0 14px !important;
          background: #11110f !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header > div p:first-child {
          display: none !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header h1 {
          margin-top: 0 !important;
          max-width: 420px !important;
          font-size: 30px !important;
          line-height: 1.15 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header > div > p:last-child {
          max-width: 440px !important;
          margin-top: 12px !important;
          font-size: 14px !important;
          line-height: 1.7 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header label {
          max-width: 260px !important;
          margin-top: 28px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header select {
          border-radius: 6px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type {
          grid-column: 2 !important;
          grid-row: 1 !important;
          min-height: 292px !important;
          margin: 0 !important;
          padding: 36px !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: center !important;
          gap: 26px !important;
          border: 1px solid #d9ddd6 !important;
          border-radius: 0 14px 14px 0 !important;
          background: #eef1ec !important;
          color: #172019 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:first-child p:first-child {
          color: #536158 !important;
          font-size: 10px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:first-child p:last-child {
          font-size: 64px !important;
          line-height: 1 !important;
          color: #1f6a58 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child {
          min-width: 0 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child > div:first-child {
          color: #536158 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child > div:last-child {
          height: 6px !important;
          background: #d5dbd4 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2),
        [data-heirloom-getting-started-parity="true"] main > main > details {
          grid-column: 1 / -1 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2) {
          margin-top: 26px !important;
          gap: 10px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2) > a {
          min-height: 92px !important;
          padding: 18px 20px !important;
          border-radius: 7px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > details {
          margin-top: 22px !important;
        }
      }
    `}</style>
    {children}
  </div>
}
