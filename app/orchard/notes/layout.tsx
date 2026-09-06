import type { ReactNode } from "react"

export default function NotesParityLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-notes-parity="true" className="contents">{children}</div>
}
