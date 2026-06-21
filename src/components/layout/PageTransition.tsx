import { useLocation } from "react-router-dom"
import type { ReactNode } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-page-in">
      {children}
    </div>
  )
}
