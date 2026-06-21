import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Plus, Save, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface UserChannelCatalog {
  id: number
  name: string
  models: string[]
}

interface ChatAgent {
  id: string
  name: string
  prompt: string
  default_model: string
  created_at: string
  updated_at: string
}

const agentsQueryKey = ["advanced-chat-agents"] as const

export default function Agents() {
  const queryClient = useQueryClient()
  const { error, success } = useToast()
  const [activeAgentID, setActiveAgentID] = useState("")
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [defaultModel, setDefaultModel] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createPrompt, setCreatePrompt] = useState("")
  const [createDefaultModel, setCreateDefaultModel] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [deletingAgentID, setDeletingAgentID] = useState("")

  const { data: catalog = [] } = useQuery<UserChannelCatalog[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await api.get("/user/catalog")
      return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : []
    },
  })

  const { data: agents = [] } = useQuery<ChatAgent[]>({
    queryKey: agentsQueryKey,
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/agents")
      return Array.isArray(res.data)
        ? res.data.map(normalizeAgent).filter((agent): agent is ChatAgent => Boolean(agent))
        : []
    },
  })

  const modelOptions = useMemo(() => uniqueModels(catalog), [catalog])
  const activeAgent = useMemo(() => agents.find((agent) => agent.id === activeAgentID), [activeAgentID, agents])

  useEffect(() => {
    if (!defaultModel && modelOptions[0]) {
      setDefaultModel(modelOptions[0])
    }
    if (!createDefaultModel && modelOptions[0]) {
      setCreateDefaultModel(modelOptions[0])
    }
  }, [createDefaultModel, defaultModel, modelOptions])

  const openCreateDialog = () => {
    setCreateName("默认智能体")
    setCreatePrompt("")
    setCreateDefaultModel(modelOptions[0] || "")
    setIsCreateOpen(true)
  }

  const startEdit = (agent: ChatAgent) => {
    setActiveAgentID(agent.id)
    setName(agent.name)
    setPrompt(agent.prompt)
    setDefaultModel(agent.default_model)
  }

  const clearEdit = () => {
    setActiveAgentID("")
    setName("")
    setPrompt("")
    setDefaultModel(modelOptions[0] || "")
  }

  const createAgent = async () => {
    const trimmedName = createName.trim()
    const trimmedModel = createDefaultModel.trim()
    if (!trimmedName) {
      error("请输入智能体名称")
      return
    }
    if (!trimmedModel) {
      error("请选择默认模型")
      return
    }

    setIsCreating(true)
    try {
      const res = await api.post("/user/advanced-chat/agents", {
        name: trimmedName,
        prompt: createPrompt.trim(),
        default_model: trimmedModel,
      })
      const savedAgent = normalizeAgent(res.data)
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey })
      if (savedAgent) {
        startEdit(savedAgent)
      }
      setIsCreateOpen(false)
      success("智能体已创建")
    } catch (err) {
      error(apiErrorMessage(err, "创建智能体失败"))
    } finally {
      setIsCreating(false)
    }
  }

  const saveAgent = async () => {
    const trimmedName = name.trim()
    const trimmedModel = defaultModel.trim()
    if (!activeAgentID) {
      error("请选择智能体")
      return
    }
    if (!trimmedName) {
      error("请输入智能体名称")
      return
    }
    if (!trimmedModel) {
      error("请选择默认模型")
      return
    }

    setIsSaving(true)
    try {
      const res = await api.put(`/user/advanced-chat/agents/${encodeURIComponent(activeAgentID)}`, {
        name: trimmedName,
        prompt: prompt.trim(),
        default_model: trimmedModel,
      })
      const savedAgent = normalizeAgent(res.data)
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey })
      if (savedAgent) {
        startEdit(savedAgent)
      }
      success("智能体已保存")
    } catch (err) {
      error(apiErrorMessage(err, "保存智能体失败"))
    } finally {
      setIsSaving(false)
    }
  }

  const deleteAgent = async (agent: ChatAgent) => {
    setDeletingAgentID(agent.id)
    try {
      await api.delete(`/user/advanced-chat/agents/${encodeURIComponent(agent.id)}`)
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey })
      if (activeAgentID === agent.id) {
        clearEdit()
      }
      success("智能体已删除")
    } catch (err) {
      error(apiErrorMessage(err, "删除智能体失败"))
    } finally {
      setDeletingAgentID("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">智能体</h1>
          <p className="mt-1 text-sm text-muted-foreground">为高级独立聊天配置提示词和默认模型。</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus size={16} />
          新建智能体
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>智能体列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无智能体</div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-start gap-2 rounded-md border p-3",
                    agent.id === activeAgent?.id && "border-primary bg-primary/5"
                  )}
                >
                  <button type="button" className="min-w-0 text-left" onClick={() => startEdit(agent)}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{agent.name}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{agent.default_model}</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingAgentID === agent.id}
                    onClick={() => deleteAgent(agent)}
                    title="删除智能体"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeAgent ? "编辑智能体" : "智能体详情"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeAgent ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">名称</span>
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">默认模型</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={defaultModel}
                      onChange={(event) => setDefaultModel(event.target.value)}
                    >
                      <option value="">选择模型</option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">提示词</span>
                  <textarea
                    className="min-h-72 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={prompt}
                    placeholder="输入这个智能体的系统提示词"
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </label>
                <div className="flex justify-end">
                  <Button className="gap-2" disabled={isSaving} onClick={saveAgent}>
                    <Save size={16} />
                    {isSaving ? "保存中" : "保存"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
                选择左侧智能体进行编辑，或点击新建智能体。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建智能体</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">名称</span>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">默认模型</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={createDefaultModel}
                  onChange={(event) => setCreateDefaultModel(event.target.value)}
                >
                  <option value="">选择模型</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">提示词</span>
              <textarea
                className="min-h-48 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={createPrompt}
                placeholder="输入这个智能体的系统提示词"
                onChange={(event) => setCreatePrompt(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button className="gap-2" disabled={isCreating} onClick={createAgent}>
              <Save size={16} />
              {isCreating ? "创建中" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function uniqueModels(catalog: UserChannelCatalog[]) {
  return Array.from(new Set(catalog.flatMap((channel) => channel.models))).sort()
}

function normalizeCatalogItem(value: unknown): UserChannelCatalog {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    models: Array.isArray(item.models) ? item.models.filter((model): model is string => typeof model === "string") : [],
  }
}

function normalizeAgent(value: unknown): ChatAgent | null {
  if (!isRecord(value)) {
    return null
  }
  const id = stringFromUnknown(value.id)
  if (!id) {
    return null
  }
  return {
    id,
    name: typeof value.name === "string" ? value.name : "",
    prompt: typeof value.prompt === "string" ? value.prompt : "",
    default_model: typeof value.default_model === "string" ? value.default_model : "",
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
  }
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (isRecord(err)) {
    const response = err.response
    if (isRecord(response)) {
      const data = response.data
      if (isRecord(data)) {
        if (typeof data.error === "string" && data.error) {
          return data.error
        }
        if (typeof data.message === "string" && data.message) {
          return data.message
        }
      }
      if (typeof data === "string" && data) {
        return data
      }
    }
  }
  return err instanceof Error && err.message ? err.message : fallback
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
