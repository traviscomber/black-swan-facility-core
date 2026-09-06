import type { ReactNode } from "react"

export default function NotesParityLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-notes-parity="true" className="contents">
    <style>{`
      @media (min-width: 768px) {
        [data-heirloom-notes-parity="true"] main > main {
          max-width: none !important;
          padding: 0 !important;
        }
        [data-heirloom-notes-parity="true"] main > main > header {
          display: flex !important;
          min-height: 52px !important;
          margin: 0 !important;
          padding: 8px 16px !important;
          align-items: center !important;
          justify-content: flex-end !important;
          border-bottom: 0 !important;
        }
        [data-heirloom-notes-parity="true"] main > main > header > div {
          display: none !important;
        }
        [data-heirloom-notes-parity="true"] main > main > header > button {
          min-height: 38px !important;
          margin-left: auto !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
        }
        [data-heirloom-notes-parity="true"] main > main > section:first-of-type {
          min-height: 54px !important;
          margin: 0 !important;
          padding: 8px 16px !important;
          border-bottom: 1px solid #302f2b !important;
        }
        [data-heirloom-notes-parity="true"] main > main > section:first-of-type label {
          max-width: 340px !important;
          min-height: 38px !important;
          border-radius: 0 !important;
          border-top: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: transparent !important;
        }
        [data-heirloom-notes-parity="true"] main > main > div.grid {
          min-height: calc(100dvh - 162px) !important;
          border: 0 !important;
          border-radius: 0 !important;
          grid-template-columns: 375px minmax(0, 1fr) !important;
        }
        [data-heirloom-notes-parity="true"] main > main > div.grid > div:first-child > div {
          max-height: calc(100dvh - 162px) !important;
        }
        [data-heirloom-notes-parity="true"] main > main > div.grid > div:first-child button {
          padding: 13px 16px !important;
        }
        [data-heirloom-notes-parity="true"] main > main article {
          max-width: 760px !important;
          padding-top: 34px !important;
        }
      }
    `}</style>
    {children}
  </div>
}
