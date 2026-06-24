import { useLocation } from "react-router-dom"
import { PageComponentSlots } from "@/components/layout/PageComponentSlots"
import { pageKeyFromPathname } from "@/lib/page-layouts"

export function PageTitleSlot() {
  const location = useLocation()
  return <PageComponentSlots pageKey={pageKeyFromPathname(location.pathname)} slotKey="before" />
}
