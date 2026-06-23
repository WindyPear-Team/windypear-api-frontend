import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Save, Server, Sparkles, Trash2, Wand2 } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface MCPServer {
  id: string
  name: string
  url: string
  enabled: boolean
  request_mode: "backend" | "frontend" | string
}

interface AdvancedChatUserSettings {
  mcp_servers: MCPServer[]
  builtin_mcp_servers: MCPServer[]
  custom_mcp_servers: MCPServer[]
}

interface ChatSkill {
  id: string
  name: string
  description: string
  prompt: string
  mcp_server_ids: string[]
  created_at: string
  updated_at: string
}

interface PromptTemplate {
  id: string
  title: string
  description: string
  prompt: string
}

const skillsQueryKey = ["advanced-chat-skills"] as const

const promptTemplateDefinitions = [
  {
    id: "code-review",
    titleKey: "advancedChat.skills.template.codeReview.title",
    descriptionKey: "advancedChat.skills.template.codeReview.description",
    promptKey: "advancedChat.skills.template.codeReview.prompt",
  },
  {
    id: "writing",
    titleKey: "advancedChat.skills.template.writing.title",
    descriptionKey: "advancedChat.skills.template.writing.description",
    promptKey: "advancedChat.skills.template.writing.prompt",
  },
  {
    id: "translation",
    titleKey: "advancedChat.skills.template.translation.title",
    descriptionKey: "advancedChat.skills.template.translation.description",
    promptKey: "advancedChat.skills.template.translation.prompt",
  },
  {
    id: "data-analysis",
    titleKey: "advancedChat.skills.template.dataAnalysis.title",
    descriptionKey: "advancedChat.skills.template.dataAnalysis.description",
    promptKey: "advancedChat.skills.template.dataAnalysis.prompt",
  },
  {
    id: "tutor",
    titleKey: "advancedChat.skills.template.tutor.title",
    descriptionKey: "advancedChat.skills.template.tutor.description",
    promptKey: "advancedChat.skills.template.tutor.prompt",
  },
  {
    id: "blank",
    titleKey: "advancedChat.skills.template.blank.title",
    descriptionKey: "advancedChat.skills.template.blank.description",
    promptKey: "advancedChat.skills.template.blank.prompt",
  },
] as const satisfies readonly {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  promptKey: TranslationKey
}[]

export default function Skills() {
  const queryClient = useQueryClient()
  const { error, success } = useToast()
  const { t } = useI18n()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingSkillID, setEditingSkillID] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [prompt, setPrompt] = useState("")
  const [selectedServerIDs, setSelectedServerIDs] = useState<string[]>([])
  const [selectedTemplateID, setSelectedTemplateID] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingSkillID, setDeletingSkillID] = useState("")

  const { data: settings } = useQuery<AdvancedChatUserSettings>({
    queryKey: ["advanced-chat-user-settings"],
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/settings")
      return normalizeUserSettings(res.data)
    },
  })

  const { data: skills = [] } = useQuery<ChatSkill[]>({
    queryKey: skillsQueryKey,
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/skills")
      return Array.isArray(res.data)
        ? res.data.map(normalizeSkill).filter((skill): skill is ChatSkill => Boolean(skill))
        : []
    },
  })

  const mcpServers = useMemo<MCPServer[]>(
    () => settings?.mcp_servers || mergeMCPServers(settings?.builtin_mcp_servers || [], settings?.custom_mcp_servers || []),
    [settings?.builtin_mcp_servers, settings?.custom_mcp_servers, settings?.mcp_servers]
  )
  const serverName = useMemo(() => {
    const map = new Map<string, string>()
    mcpServers.forEach((server) => map.set(server.id, server.name))
    return map
  }, [mcpServers])
  const promptTemplates = useMemo<PromptTemplate[]>(
    () =>
      promptTemplateDefinitions.map((template) => ({
        id: template.id,
        title: t(template.titleKey),
        description: t(template.descriptionKey),
        prompt: t(template.promptKey),
      })),
    [t]
  )

  const resetForm = () => {
    setEditingSkillID("")
    setName("")
    setDescription("")
    setPrompt("")
    setSelectedServerIDs([])
    setSelectedTemplateID("")
  }

  const openCreateDialog = () => {
    resetForm()
    setName(t("advancedChat.skills.defaultName"))
    setIsEditOpen(true)
  }

  const openEditDialog = (skill: ChatSkill) => {
    setEditingSkillID(skill.id)
    setName(skill.name)
    setDescription(skill.description)
    setPrompt(skill.prompt)
    setSelectedServerIDs(skill.mcp_server_ids)
    setSelectedTemplateID("")
    setIsEditOpen(true)
  }

  const applyTemplate = (templateID: string) => {
    setSelectedTemplateID(templateID)
    const template = promptTemplates.find((item) => item.id === templateID)
    if (template) {
      setPrompt(template.prompt)
    }
  }

  const toggleServer = (id: string) => {
    setSelectedServerIDs((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const saveSkill = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      error(t("advancedChat.skills.nameRequired"))
      return
    }

    const payload = {
      name: trimmedName,
      description: description.trim(),
      prompt: prompt.trim(),
      mcp_server_ids: selectedServerIDs,
    }

    setIsSaving(true)
    try {
      if (editingSkillID) {
        await api.put(`/user/advanced-chat/skills/${encodeURIComponent(editingSkillID)}`, payload)
      } else {
        await api.post("/user/advanced-chat/skills", payload)
      }
      await queryClient.invalidateQueries({ queryKey: skillsQueryKey })
      setIsEditOpen(false)
      resetForm()
      success(editingSkillID ? t("advancedChat.skills.saved") : t("advancedChat.skills.created"))
    } catch (err) {
      error(apiErrorMessage(err, t("advancedChat.skills.saveFailed")))
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSkill = async (skill: ChatSkill) => {
    setDeletingSkillID(skill.id)
    try {
      await api.delete(`/user/advanced-chat/skills/${encodeURIComponent(skill.id)}`)
      await queryClient.invalidateQueries({ queryKey: skillsQueryKey })
      success(t("advancedChat.skills.deleted"))
    } catch (err) {
      error(apiErrorMessage(err, t("advancedChat.skills.deleteFailed")))
    } finally {
      setDeletingSkillID("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.skills")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("advancedChat.skills.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus size={16} />
          {t("advancedChat.skills.newSkill")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("advancedChat.skills.list")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">{t("advancedChat.skills.empty")}</div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.id}
                className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <button type="button" className="min-w-0 w-full text-left" onClick={() => openEditDialog(skill)}>
                  <div className="flex min-w-0 items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{skill.name}</span>
                  </div>
                  {skill.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{skill.description}</div>
                  )}
                  {skill.mcp_server_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {skill.mcp_server_ids.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          <Server size={11} />
                          {serverName.get(id) || id}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletingSkillID === skill.id}
                  onClick={() => deleteSkill(skill)}
                  title={t("advancedChat.skills.deleteSkill")}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkillID ? t("advancedChat.skills.editSkill") : t("advancedChat.skills.newSkill")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("common.name")}</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("common.description")}</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={description}
                placeholder={t("advancedChat.skills.descriptionPlaceholder")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <div className="space-y-2 text-sm">
              <span className="flex items-center gap-1 font-medium">
                <Wand2 size={14} />
                {t("advancedChat.skills.promptTemplate")}
              </span>
              <div className="flex flex-wrap gap-2">
                {promptTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    title={template.description}
                    onClick={() => applyTemplate(template.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                      selectedTemplateID === template.id && "border-primary bg-primary/5 text-primary"
                    )}
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("advancedChat.skills.prompt")}</span>
              <textarea
                className="min-h-60 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={prompt}
                placeholder={t("advancedChat.skills.promptPlaceholder")}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>

            <div className="space-y-2 text-sm">
              <span className="flex items-center gap-1 font-medium">
                <Server size={14} />
                {t("advancedChat.skills.mcpServers")}
              </span>
              {mcpServers.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("advancedChat.skills.noMCPServersHint")}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {mcpServers.map((server) => {
                    const checked = selectedServerIDs.includes(server.id)
                    return (
                      <label
                        key={server.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50",
                          checked && "border-primary bg-primary/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleServer(server.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{server.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{server.url}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="gap-2" disabled={isSaving} onClick={saveSkill}>
              <Save size={16} />
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function normalizeUserSettings(value: unknown): AdvancedChatUserSettings {
  const item = isRecord(value) ? value : {}
  const builtin = Array.isArray(item.builtin_mcp_servers) ? item.builtin_mcp_servers.map(normalizeMCPServer) : []
  const custom = Array.isArray(item.custom_mcp_servers) ? item.custom_mcp_servers.map(normalizeMCPServer) : []
  return {
    mcp_servers: Array.isArray(item.mcp_servers) ? item.mcp_servers.map(normalizeMCPServer) : mergeMCPServers(builtin, custom),
    builtin_mcp_servers: builtin,
    custom_mcp_servers: custom,
  }
}

function normalizeMCPServer(value: unknown): MCPServer {
  const item = isRecord(value) ? value : {}
  return {
    id: typeof item.id === "string" && item.id ? item.id : "",
    name: typeof item.name === "string" ? item.name : "",
    url: typeof item.url === "string" ? item.url : "",
    enabled: item.enabled !== false,
    request_mode: typeof item.request_mode === "string" ? item.request_mode : "frontend",
  }
}

function normalizeSkill(value: unknown): ChatSkill | null {
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
    description: typeof value.description === "string" ? value.description : "",
    prompt: typeof value.prompt === "string" ? value.prompt : "",
    mcp_server_ids: Array.isArray(value.mcp_server_ids)
      ? value.mcp_server_ids.filter((item): item is string => typeof item === "string")
      : [],
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

function mergeMCPServers(...groups: MCPServer[][]) {
  const servers: MCPServer[] = []
  const seen = new Set<string>()
  for (const server of groups.flat()) {
    if (!server.id || seen.has(server.id)) {
      continue
    }
    seen.add(server.id)
    servers.push(server)
  }
  return servers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
