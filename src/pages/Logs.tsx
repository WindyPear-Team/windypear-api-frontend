import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { TabTransition } from "@/components/layout/TabTransition"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useI18n } from "@/lib/i18n"

interface TokenLog {
  id: number
  created_at: string
  api_key_id?: number
  user_channel_id?: number
  channel_id: number
  model_name: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number
  cost: string | number
}

interface PaymentOrder {
  order_no: string
  amount: string
  rmb_amount: string
  method: string
  status: string
  created_at?: string
  paid_at?: string
}

interface CheckInRecord {
  check_in_date: string
  reward_amount: string
  streak_days: number
  reward_kind: string
}

type DetailTab = "calls" | "payments" | "checkIns"

export default function Logs() {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhDetailsCopy : enDetailsCopy
  const [activeTab, setActiveTab] = useState<DetailTab>("calls")

  const { data: logs = [], isLoading: isLogsLoading } = useQuery<TokenLog[]>({
    queryKey: ["logs", "user"],
    queryFn: async () => {
      const res = await api.get("/user/logs")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: paymentOrders = [], isLoading: isPaymentOrdersLoading } = useQuery<PaymentOrder[]>({
    queryKey: ["payment-orders"],
    queryFn: async () => {
      const res = await api.get("/user/payment/orders")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: checkInRecords = [], isLoading: isCheckInRecordsLoading } = useQuery<CheckInRecord[]>({
    queryKey: ["check-in-records"],
    queryFn: async () => {
      const res = await api.get("/user/check-in/records")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        <Button variant={activeTab === "calls" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("calls")}>
          {copy.callRecords}
        </Button>
        <Button variant={activeTab === "payments" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("payments")}>
          {copy.paymentOrders}
        </Button>
        <Button variant={activeTab === "checkIns" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("checkIns")}>
          {copy.checkInRecords}
        </Button>
      </div>

      <TabTransition activeKey={activeTab} order={["calls", "payments", "checkIns"]}>
        {activeTab === "calls" && <CallRecordsTable logs={logs} loading={isLogsLoading} t={t} />}
        {activeTab === "payments" && <PaymentOrdersTable orders={paymentOrders} loading={isPaymentOrdersLoading} copy={copy} />}
        {activeTab === "checkIns" && <CheckInRecordsTable records={checkInRecords} loading={isCheckInRecordsLoading} copy={copy} />}
      </TabTransition>
    </div>
  )
}

function CallRecordsTable({ logs, loading, t }: { logs: TokenLog[]; loading: boolean; t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.time")}</TableHead>
            <TableHead>{t("usage.apiKey")}</TableHead>
            <TableHead>{t("usage.userChannel")}</TableHead>
            <TableHead>{t("usage.upstreamChannel")}</TableHead>
            <TableHead>{t("common.model")}</TableHead>
            <TableHead>{t("common.tokens")}</TableHead>
            <TableHead>{t("usage.cachedInput")}</TableHead>
            <TableHead>{t("common.cost")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {t("common.loading")}
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {t("usage.noUsage")}
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDateTime(log.created_at)}</TableCell>
                <TableCell>{log.api_key_id || "-"}</TableCell>
                <TableCell>{log.user_channel_id || "-"}</TableCell>
                <TableCell>{log.channel_id}</TableCell>
                <TableCell>{log.model_name}</TableCell>
                <TableCell>{log.input_tokens} / {log.output_tokens}</TableCell>
                <TableCell>{log.cached_input_tokens || 0}</TableCell>
                <TableCell>${log.cost}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PaymentOrdersTable({ orders, loading, copy }: { orders: PaymentOrder[]; loading: boolean; copy: typeof zhDetailsCopy }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.orderNo}</TableHead>
            <TableHead>{copy.amount}</TableHead>
            <TableHead>{copy.rmbAmount}</TableHead>
            <TableHead>{copy.method}</TableHead>
            <TableHead>{copy.status}</TableHead>
            <TableHead>{copy.createdAt}</TableHead>
            <TableHead>{copy.paidAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.loading}</TableCell></TableRow>
          ) : orders.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.noPaymentOrders}</TableCell></TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.order_no}>
                <TableCell className="font-mono text-xs">{order.order_no}</TableCell>
                <TableCell>{order.amount}</TableCell>
                <TableCell>{order.rmb_amount}</TableCell>
                <TableCell>{paymentMethodLabel(order.method, copy)}</TableCell>
                <TableCell>{paymentStatusLabel(order.status, copy)}</TableCell>
                <TableCell>{order.created_at ? formatDateTime(order.created_at) : "-"}</TableCell>
                <TableCell>{order.paid_at ? formatDateTime(order.paid_at) : "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function CheckInRecordsTable({ records, loading, copy }: { records: CheckInRecord[]; loading: boolean; copy: typeof zhDetailsCopy }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.date}</TableHead>
            <TableHead>{copy.reward}</TableHead>
            <TableHead>{copy.streak}</TableHead>
            <TableHead>{copy.rewardKind}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{copy.loading}</TableCell></TableRow>
          ) : records.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{copy.noCheckInRecords}</TableCell></TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.check_in_date}>
                <TableCell>{record.check_in_date}</TableCell>
                <TableCell>{record.reward_amount}</TableCell>
                <TableCell>{copy.streakDays.replace("{days}", String(record.streak_days))}</TableCell>
                <TableCell>{rewardKindLabel(record.reward_kind, copy)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function paymentMethodLabel(method: string, copy: typeof zhDetailsCopy) {
  switch (method.toLowerCase()) {
    case "alipay":
      return copy.alipay
    case "wxpay":
      return copy.wxpay
    default:
      return method
  }
}

function paymentStatusLabel(status: string, copy: typeof zhDetailsCopy) {
  switch (status.toLowerCase()) {
    case "paid":
      return copy.paid
    case "pending":
      return copy.pending
    default:
      return status || "-"
  }
}

function rewardKindLabel(kind: string, copy: typeof zhDetailsCopy) {
  if (!kind) {
    return "-"
  }
  return kind
    .split("_")
    .map((item) => {
      switch (item) {
        case "daily":
          return copy.rewardDaily
        case "streak":
          return copy.rewardStreak
        case "random":
          return copy.rewardRandom
        default:
          return item
      }
    })
    .join(" + ")
}

function formatDateTime(value: string) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const zhDetailsCopy = {
  title: "明细",
  subtitle: "集中查看调用、充值和签到等账户明细",
  callRecords: "调用记录",
  paymentOrders: "充值订单",
  checkInRecords: "签到记录",
  orderNo: "订单号",
  amount: "金额",
  rmbAmount: "人民币金额",
  method: "支付方式",
  status: "状态",
  createdAt: "创建时间",
  paidAt: "支付时间",
  noPaymentOrders: "暂无充值订单",
  date: "日期",
  reward: "奖励",
  streak: "连续天数",
  rewardKind: "奖励类型",
  noCheckInRecords: "暂无签到记录",
  streakDays: "连续 {days} 天",
  loading: "加载中...",
  alipay: "支付宝",
  wxpay: "微信支付",
  paid: "已支付",
  pending: "待支付",
  rewardDaily: "每日",
  rewardStreak: "连续",
  rewardRandom: "随机",
}

const enDetailsCopy: typeof zhDetailsCopy = {
  title: "Details",
  subtitle: "Review call, recharge, and check-in account details",
  callRecords: "Call records",
  paymentOrders: "Payment orders",
  checkInRecords: "Check-in records",
  orderNo: "Order no.",
  amount: "Amount",
  rmbAmount: "RMB amount",
  method: "Method",
  status: "Status",
  createdAt: "Created at",
  paidAt: "Paid at",
  noPaymentOrders: "No payment orders",
  date: "Date",
  reward: "Reward",
  streak: "Streak",
  rewardKind: "Reward type",
  noCheckInRecords: "No check-in records",
  streakDays: "{days} day streak",
  loading: "Loading...",
  alipay: "Alipay",
  wxpay: "WeChat Pay",
  paid: "Paid",
  pending: "Pending",
  rewardDaily: "Daily",
  rewardStreak: "Streak",
  rewardRandom: "Random",
}
