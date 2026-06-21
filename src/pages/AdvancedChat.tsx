import { Bot, MessageSquare, UserCircle } from "lucide-react"
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Chat from "./Chat"
import Agents from "./Agents"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PublicSettings } from "@/lib/public-settings"
import { parseTopNavItems, withPublicSettingsDefaults } from "@/lib/public-settings"
import { cn } from "@/lib/utils"

interface CurrentUser {
  username?: string
  email?: string
  avatar_url?: string
}

export default function AdvancedChat() {
  const { t } = useI18n()
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const { data: user } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const topNavItems = parseTopNavItems(publicSettings.top_nav_items)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          {publicSettings.icon_url && <img src={publicSettings.icon_url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />}
          <span className="truncate text-sm font-semibold">{publicSettings.site_name}</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {publicSettings.top_nav_enabled && topNavItems.length > 0 && (
            <div className="hidden min-w-0 items-center gap-4 text-sm text-muted-foreground lg:flex">
              {topNavItems.map((item) => (
                <TopNavLink key={`${item.label}-${item.href}`} label={item.label} href={item.href} external={item.external} />
              ))}
            </div>
          )}
          <UserAvatar user={user} />
        </div>
      </header>

      {publicSettings.announcement && (
        <div className="border-b bg-muted/50 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl whitespace-pre-wrap">{publicSettings.announcement}</div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-8">
        <AdvancedChatSidebar chatLabel={t("nav.chat")} agentsLabel={t("nav.agents")} />
        <div className="min-w-0">
          <Routes>
            <Route index element={<Chat variant="advanced" />} />
            <Route path="agents" element={<Agents />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </main>

      {publicSettings.footer_text && (
        <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          {publicSettings.footer_text}
        </footer>
      )}
    </div>
  )
}

function AdvancedChatSidebar({ chatLabel, agentsLabel }: { chatLabel: string; agentsLabel: string }) {
  const location = useLocation()
  const items = [
    { href: "/chat", label: chatLabel, icon: MessageSquare, active: location.pathname === "/chat" },
    { href: "/chat/agents", label: agentsLabel, icon: Bot, active: location.pathname === "/chat/agents" },
  ]

  return (
    <aside className="h-fit rounded-md border bg-card p-2">
      <nav className="flex gap-1 lg:flex-col">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:flex-none",
              item.active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}

function UserAvatar({ user }: { user?: CurrentUser }) {
  const label = user?.username || user?.email || "User"
  const initials = avatarInitials(label)
  return (
    <Link
      to="/dashboard/settings"
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold text-foreground hover:bg-accent"
      title={label}
      aria-label={label}
    >
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserCircle size={20} />
      )}
    </Link>
  )
}

function avatarInitials(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

function TopNavLink({ label, href, external }: { label: string; href: string; external: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  }
  return <Link to={href}>{label}</Link>
}
