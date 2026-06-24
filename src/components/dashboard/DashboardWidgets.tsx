import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  KeyRound,
  LineChart,
  Megaphone,
  MessageSquare,
  Server,
  UserCircle,
  WalletCards,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { PageComponentWidth } from "@/lib/page-layouts"
import type { PublicSettings } from "@/lib/public-settings"
import { chatPathForSettings, imagePathForSettings, withPublicSettingsDefaults } from "@/lib/public-settings"
import { cn } from "@/lib/utils"

interface CurrentUser {
  username?: string
  email?: string
  balance?: string | number
}

interface UserStats {
  balance: string | number
  total_requests: number
  today_requests: number
  total_cost: string | number
  rpm: number
  tpm: number
}

interface Announcement {
  id: number
  title: string
  content: string
  created_at: string
}

interface PublicStatusMonitor {
  id: number
  name: string
  status: string
  latency_ms: number
  last_checked_at?: string | null
  uptime: number
}

interface PublicStatusResponse {
  monitors: PublicStatusMonitor[]
}

interface StatCard {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
}

interface PageComponentPreset {
  type: string
  label: {
    zh: string
    en: string
  }
  description: {
    zh: string
    en: string
  }
  defaultWidth: PageComponentWidth
  icon: LucideIcon
}

export const pageComponentPresets: PageComponentPreset[] = [
  {
    type: "dashboard_stats",
    label: { zh: "用户统计", en: "User stats" },
    description: { zh: "余额、请求量、速率和总成本。", en: "Balance, requests, rate, and total cost." },
    defaultWidth: "full",
    icon: BarChart3,
  },
  {
    type: "announcements",
    label: { zh: "公告列表", en: "Announcements" },
    description: { zh: "展示启用的用户公告。", en: "Shows enabled user announcements." },
    defaultWidth: "half",
    icon: Megaphone,
  },
  {
    type: "node_status",
    label: { zh: "节点状态", en: "Node status" },
    description: { zh: "展示公开监控节点的可用性。", en: "Shows public monitor availability." },
    defaultWidth: "half",
    icon: Server,
  },
  {
    type: "account_summary",
    label: { zh: "账户概览", en: "Account summary" },
    description: { zh: "展示当前账户和用量摘要。", en: "Shows the current account and usage summary." },
    defaultWidth: "third",
    icon: UserCircle,
  },
  {
    type: "quick_links",
    label: { zh: "快捷入口", en: "Quick links" },
    description: { zh: "提供聊天、密钥、钱包等常用入口。", en: "Links to chat, API keys, wallet, and details." },
    defaultWidth: "third",
    icon: ArrowRight,
  },
]

export function PageComponent({ type }: { type: string }) {
  switch (type) {
    case "dashboard_stats":
      return <DashboardStatsWidget />
    case "announcements":
      return <AnnouncementsWidget />
    case "node_status":
      return <NodeStatusWidget />
    case "account_summary":
      return <AccountSummaryWidget />
    case "quick_links":
      return <QuickLinksWidget />
    default:
      return null
  }
}

export function pageComponentLabel(type: string, language: string) {
  const preset = pageComponentPresets.find((item) => item.type === type)
  if (!preset) {
    return type
  }
  return language === "zh" ? preset.label.zh : preset.label.en
}

export function pageComponentDescription(type: string, language: string) {
  const preset = pageComponentPresets.find((item) => item.type === type)
  if (!preset) {
    return ""
  }
  return language === "zh" ? preset.description.zh : preset.description.en
}

export function defaultWidthForPageComponent(type: string): PageComponentWidth {
  return pageComponentPresets.find((item) => item.type === type)?.defaultWidth || "half"
}

function DashboardStatsWidget() {
  const { t } = useI18n()
  const { data: user, isLoading: isUserLoading } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["stats", "user"],
    queryFn: async () => {
      const res = await api.get("/user/stats")
      return res.data
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })

  const currencyDisplayName = withPublicSettingsDefaults(settings).payment_currency_display_name
  const cards = isUserLoading ? userCards(t, currencyDisplayName) : userCards(t, currencyDisplayName, userStats, user)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={cn("h-4 w-4", card.color)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AnnouncementsWidget() {
  const { t } = useI18n()
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const res = await api.get("/public/announcements")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("dashboard.announcements")}</CardTitle>
        <Megaphone className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : announcements.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.noAnnouncements")}</div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-md border p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="text-base font-semibold">{announcement.title}</h2>
                  <div className="shrink-0 text-xs text-muted-foreground">{formatDateTime(announcement.created_at)}</div>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{announcement.content}</div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NodeStatusWidget() {
  const { t } = useI18n()
  const { data: publicStatus, isLoading, isError } = useQuery<PublicStatusResponse>({
    queryKey: ["public-status"],
    queryFn: async () => {
      const res = await api.get("/public/status")
      return res.data
    },
    retry: false,
    refetchInterval: 30000,
  })
  const monitors = publicStatus?.monitors || []

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("dashboard.nodeStatus")}</CardTitle>
        <Server className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : isError ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.statusUnavailable")}</div>
        ) : monitors.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.noNodeStatus")}</div>
        ) : (
          <div className="grid gap-3">
            {monitors.map((monitor) => (
              <div key={monitor.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{monitor.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("dashboard.lastCheck")}: {formatDateTime(monitor.last_checked_at)}
                    </div>
                  </div>
                  <div className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", statusBadgeClass(monitor.status))}>
                    <StatusIcon status={monitor.status} />
                    {statusLabel(monitor.status, t)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">{t("dashboard.latency")}</div>
                    <div className="mt-1 font-medium">{formatLatency(monitor.latency_ms)}</div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">{t("dashboard.uptime")}</div>
                    <div className="mt-1 font-medium">{formatPercent(monitor.uptime)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AccountSummaryWidget() {
  const { language, t } = useI18n()
  const { data: user } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["stats", "user"],
    queryFn: async () => {
      const res = await api.get("/user/stats")
      return res.data
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const currencyDisplayName = withPublicSettingsDefaults(settings).payment_currency_display_name
  const title = language === "zh" ? "账户概览" : "Account summary"

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <UserCircle className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="truncate text-base font-semibold">{user?.username || user?.email || t("common.user")}</div>
          {user?.email && <div className="mt-1 truncate text-sm text-muted-foreground">{user.email}</div>}
        </div>
        <div className="grid gap-3 text-sm">
          <SummaryRow label={t("common.balance")} value={`${currencyDisplayName}${formatMoney(userStats?.balance ?? user?.balance ?? 0)}`} />
          <SummaryRow label={t("dashboard.todayRequests")} value={userStats?.today_requests || 0} />
          <SummaryRow label={t("dashboard.totalRequests")} value={userStats?.total_requests || 0} />
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLinksWidget() {
  const { language, t } = useI18n()
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const title = language === "zh" ? "快捷入口" : "Quick links"
  const actions = [
    { label: t("nav.chat"), href: chatPathForSettings(publicSettings), icon: MessageSquare },
    { label: t("settings.apiKeys"), href: "/dashboard/api-keys", icon: KeyRound },
    { label: t("nav.wallet"), href: "/dashboard/wallet", icon: WalletCards },
    { label: t("nav.details"), href: "/dashboard/logs", icon: Database },
    { label: t("nav.images"), href: imagePathForSettings(publicSettings), icon: Activity },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((action) => (
          <Button key={action.href} variant="outline" className="justify-between" asChild>
            <Link to={action.href}>
              <span className="inline-flex min-w-0 items-center gap-2">
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{action.label}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  )
}

function userCards(t: ReturnType<typeof useI18n>["t"], currencyDisplayName: string, stats?: UserStats, user?: CurrentUser): StatCard[] {
  return [
    { title: t("common.balance"), value: `${currencyDisplayName}${formatMoney(stats?.balance ?? user?.balance ?? 0)}`, icon: CreditCard, color: "text-blue-500" },
    { title: t("dashboard.todayRequests"), value: stats?.today_requests || 0, icon: Activity, color: "text-green-500" },
    { title: t("dashboard.totalRequests"), value: stats?.total_requests || 0, icon: Database, color: "text-purple-500" },
    { title: t("dashboard.rpm"), value: stats?.rpm || 0, icon: BarChart3, color: "text-cyan-500" },
    { title: t("dashboard.tpm"), value: stats?.tpm || 0, icon: LineChart, color: "text-pink-500" },
    { title: t("dashboard.totalCost"), value: `${currencyDisplayName}${formatMoney(stats?.total_cost || 0)}`, icon: DollarSign, color: "text-yellow-500" },
  ]
}

function formatMoney(value: string | number) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return "0.00"
  }
  return amount.toFixed(2)
}

function StatusIcon({ status }: { status: string }) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return <CheckCircle2 size={14} />
    case "down":
      return <AlertTriangle size={14} />
    default:
      return <Clock size={14} />
  }
}

function statusBadgeClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    case "down":
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  }
}

function statusLabel(status: string, t: ReturnType<typeof useI18n>["t"]) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return t("dashboard.statusUp")
    case "down":
      return t("dashboard.statusDown")
    default:
      return t("dashboard.statusPending")
  }
}

function formatLatency(value: number) {
  if (!value || value <= 0) {
    return "-"
  }
  return `${value}ms`
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "-"
  }
  return `${value.toFixed(2)}%`
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
