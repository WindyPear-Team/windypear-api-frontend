import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Bot, Check, MessageSquarePlus, Pencil, Send, Settings, Trash2, User, X } from "lucide-react"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
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

interface APIKey {
  id: number
  name: string
  api_key: string
  key_prefix: string
  allowed_models: string[]
  enabled: boolean
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at?: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  agent_id?: string
  model_name?: string
  created_at: string
  updated_at: string
}

interface ChatAgent {
  id: string
  name: string
  prompt: string
  default_model: string
  created_at: string
  updated_at: string
}

type ChatEndpoint = "chat" | "responses" | "claude" | "gemini"
type ChatMode = "basic" | "advanced"

interface ChatProps {
  variant?: ChatMode
}

interface ChatStoreKeys {
  sessions: string
  selectedSession: string
  model: string
  endpoint: string
  apiKey: string
}

const sessionsStoreKey = "windypear.chat.sessions.v1"
const legacyMessagesStoreKey = "windypear.chat.messages.v1"
const selectedSessionStoreKey = "windypear.chat.selected_session.v1"
const modelStoreKey = "windypear.chat.model.v1"
const endpointStoreKey = "windypear.chat.endpoint.v1"
const apiKeyStoreKey = "windypear.chat.api_key_id.v1"
const selectedAgentStoreKey = "windypear.advanced_chat.selected_agent.v1"
const agentsQueryKey = ["advanced-chat-agents"] as const

const chatStoreKeys: Record<ChatMode, ChatStoreKeys> = {
  basic: {
    sessions: sessionsStoreKey,
    selectedSession: selectedSessionStoreKey,
    model: modelStoreKey,
    endpoint: endpointStoreKey,
    apiKey: apiKeyStoreKey,
  },
  advanced: {
    sessions: "windypear.advanced_chat.sessions.v1",
    selectedSession: "windypear.advanced_chat.selected_session.v1",
    model: "windypear.advanced_chat.model.v1",
    endpoint: "windypear.advanced_chat.endpoint.v1",
    apiKey: "windypear.advanced_chat.api_key_id.v1",
  },
}

export default function Chat({ variant = "basic" }: ChatProps) {
  const isAdvanced = variant === "advanced"
  const storeKeys = chatStoreKeys[variant]
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { error } = useToast()
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStoredSessions(storeKeys.sessions, variant === "basic"))
  const [activeSessionID, setActiveSessionID] = useState(() => localStorage.getItem(storeKeys.selectedSession) || "")
  const [modelName, setModelName] = useState(() => localStorage.getItem(storeKeys.model) || "")
  const [endpointMode, setEndpointMode] = useState<ChatEndpoint>(() => readStoredEndpoint(storeKeys.endpoint))
  const [selectedAPIKeyID, setSelectedAPIKeyID] = useState(() => Number(localStorage.getItem(storeKeys.apiKey) || 0))
  const [selectedAgentID, setSelectedAgentID] = useState(() => (isAdvanced ? localStorage.getItem(selectedAgentStoreKey) || "" : ""))
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [editingMessageID, setEditingMessageID] = useState("")
  const [editingContent, setEditingContent] = useState("")

  const { data: catalog = [] } = useQuery<UserChannelCatalog[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await api.get("/user/catalog")
      return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : []
    },
  })

  const { data: apiKeys = [] } = useQuery<APIKey[]>({
    queryKey: ["api-keys", "chat"],
    queryFn: async () => {
      const res = await api.get("/user/api-keys")
      return Array.isArray(res.data) ? res.data.map(normalizeAPIKey) : []
    },
  })

  const { data: agents = [] } = useQuery<ChatAgent[]>({
    queryKey: agentsQueryKey,
    enabled: isAdvanced,
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/agents")
      return Array.isArray(res.data)
        ? res.data.map(normalizeAgent).filter((agent): agent is ChatAgent => Boolean(agent))
        : []
    },
  })

  const modelOptions = useMemo(() => uniqueModels(catalog), [catalog])
  const selectableAPIKeys = useMemo(() => apiKeys.filter((key) => key.enabled && key.api_key), [apiKeys])
  const selectedAPIKey = useMemo(
    () => selectableAPIKeys.find((key) => key.id === selectedAPIKeyID) || selectableAPIKeys[0],
    [selectableAPIKeys, selectedAPIKeyID]
  )
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionID) || sessions[0],
    [sessions, activeSessionID]
  )
  const selectedAgent = useMemo(() => {
    if (!isAdvanced) {
      return undefined
    }
    const sessionAgentID = activeSession?.agent_id || selectedAgentID
    return agents.find((agent) => agent.id === sessionAgentID) || agents.find((agent) => agent.id === selectedAgentID) || agents[0]
  }, [activeSession?.agent_id, agents, isAdvanced, selectedAgentID])
  const activeModelName = isAdvanced ? activeSession?.model_name || selectedAgent?.default_model || modelName : modelName

  useEffect(() => {
    localStorage.setItem(storeKeys.sessions, JSON.stringify(sessions))
  }, [sessions, storeKeys.sessions])

  useEffect(() => {
    if (!activeSessionID && sessions[0]) {
      setActiveSessionID(sessions[0].id)
      return
    }
    if (activeSessionID && !sessions.some((session) => session.id === activeSessionID) && sessions[0]) {
      setActiveSessionID(sessions[0].id)
    }
  }, [activeSessionID, sessions])

  useEffect(() => {
    if (activeSessionID) {
      localStorage.setItem(storeKeys.selectedSession, activeSessionID)
    }
  }, [activeSessionID, storeKeys.selectedSession])

  useEffect(() => {
    if (!isAdvanced && modelName) {
      localStorage.setItem(storeKeys.model, modelName)
    }
  }, [isAdvanced, modelName, storeKeys.model])

  useEffect(() => {
    localStorage.setItem(storeKeys.endpoint, endpointMode)
  }, [endpointMode, storeKeys.endpoint])

  useEffect(() => {
    if (!selectedAPIKey && selectedAPIKeyID !== 0) {
      setSelectedAPIKeyID(0)
      return
    }
    if (!selectedAPIKeyID && selectedAPIKey) {
      setSelectedAPIKeyID(selectedAPIKey.id)
    }
  }, [selectedAPIKey, selectedAPIKeyID])

  useEffect(() => {
    if (selectedAPIKeyID) {
      localStorage.setItem(storeKeys.apiKey, String(selectedAPIKeyID))
    }
  }, [selectedAPIKeyID, storeKeys.apiKey])

  useEffect(() => {
    if (!isAdvanced && !modelName && modelOptions.length > 0) {
      setModelName(modelOptions[0])
    }
  }, [isAdvanced, modelName, modelOptions])

  useEffect(() => {
    if (!isAdvanced) {
      return
    }
    if (selectedAgentID && agents.some((agent) => agent.id === selectedAgentID)) {
      localStorage.setItem(selectedAgentStoreKey, selectedAgentID)
      return
    }
    if (agents[0]) {
      setSelectedAgentID(agents[0].id)
      return
    }
    setSelectedAgentID("")
    localStorage.removeItem(selectedAgentStoreKey)
  }, [agents, isAdvanced, selectedAgentID])

  useEffect(() => {
    if (!isAdvanced || !activeSession || activeSession.model_name || modelOptions.length === 0) {
      return
    }
    const defaultModel = selectedAgent?.default_model || modelOptions[0]
    updateSession(activeSession.id, (session) => ({ ...session, model_name: defaultModel }))
  }, [activeSession, isAdvanced, modelOptions, selectedAgent?.default_model])

  useEffect(() => {
    if (!isAdvanced || !activeSession || activeSession.agent_id || !selectedAgent) {
      return
    }
    updateSession(activeSession.id, (session) => ({ ...session, agent_id: selectedAgent.id }))
  }, [activeSession, isAdvanced, selectedAgent])

  const createNewSession = () => {
    const session = createSession({
      agentID: isAdvanced ? selectedAgent?.id || selectedAgentID : undefined,
      modelName: isAdvanced ? selectedAgent?.default_model || modelOptions[0] || modelName : undefined,
    })
    setSessions((current) => [session, ...current])
    setActiveSessionID(session.id)
    setPrompt("")
    cancelEdit()
  }

  const deleteSession = (sessionID: string) => {
    const nextSessions = sessions.filter((session) => session.id !== sessionID)
    const fallbackSessions = nextSessions.length > 0 ? nextSessions : [createSession()]
    setSessions(fallbackSessions)
    if (activeSessionID === sessionID || !fallbackSessions.some((session) => session.id === activeSessionID)) {
      setActiveSessionID(fallbackSessions[0].id)
    }
    cancelEdit()
  }

  const updateSession = (sessionID: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionID) {
          return session
        }
        return { ...updater(session), updated_at: new Date().toISOString() }
      })
    )
  }

  const handleAgentSelection = (agentID: string) => {
    setSelectedAgentID(agentID)
    const agent = agents.find((item) => item.id === agentID)
    if (!activeSession) {
      return
    }
    updateSession(activeSession.id, (session) => ({
      ...session,
      agent_id: agentID || undefined,
      model_name: agent?.default_model || session.model_name || modelOptions[0] || "",
    }))
  }

  const handleSessionModelChange = (value: string) => {
    if (isAdvanced && activeSession) {
      updateSession(activeSession.id, (session) => ({ ...session, model_name: value }))
      return
    }
    setModelName(value)
  }

  const sendMessage = async () => {
    const content = prompt.trim()
    const rawKey = selectedAPIKey?.api_key.trim() || ""
    const session = activeSession
    const resolvedModel = activeModelName.trim()
    if (!session) {
      return
    }
    if (!rawKey) {
      error(copy.keyRequired)
      return
    }
    if (!resolvedModel) {
      error(copy.modelRequired)
      return
    }
    if (!content) {
      return
    }

    const userMessage = createMessage("user", content)
    const nextMessages = [...session.messages, userMessage]
    const nextTitle = session.title || titleFromMessage(content, copy)
    updateSession(session.id, (current) => ({ ...current, title: nextTitle, messages: nextMessages, model_name: resolvedModel }))
    setPrompt("")
    setIsSending(true)
    cancelEdit()

    try {
      const request = chatRequest(endpointMode, resolvedModel, rawKey, nextMessages, selectedAgent?.prompt || "")
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
      })
      const text = await response.text()
      let payload: any = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = null
      }
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || text || `HTTP ${response.status}`)
      }
      const answer = responseTextFromPayload(payload)
      const assistantMessage = createMessage("assistant", answer || copy.emptyResponse)
      updateSession(session.id, (current) => ({ ...current, messages: [...current.messages, assistantMessage] }))
    } catch (err) {
      error(err instanceof Error ? err.message : copy.sendFailed)
    } finally {
      setIsSending(false)
    }
  }

  const beginEditMessage = (message: ChatMessage) => {
    setEditingMessageID(message.id)
    setEditingContent(message.content)
  }

  const saveEditedMessage = () => {
    const content = editingContent.trim()
    if (!activeSession || !editingMessageID || !content) {
      return
    }
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === editingMessageID ? { ...message, content, updated_at: new Date().toISOString() } : message
      ),
    }))
    cancelEdit()
  }

  const deleteMessage = (messageID: string) => {
    if (!activeSession) {
      return
    }
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.filter((message) => message.id !== messageID),
    }))
    if (editingMessageID === messageID) {
      cancelEdit()
    }
  }

  function cancelEdit() {
    setEditingMessageID("")
    setEditingContent("")
  }

  const basicConfig = (
    <Card>
      <CardHeader>
        <CardTitle>{copy.config}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_minmax(0,1fr)]">
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={selectedAPIKey?.id || ""}
          onChange={(event) => setSelectedAPIKeyID(Number(event.target.value) || 0)}
        >
          <option value="">{selectableAPIKeys.length ? copy.selectKey : copy.noKeys}</option>
          {selectableAPIKeys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.name || key.key_prefix}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={endpointMode}
          onChange={(event) => setEndpointMode(normalizeEndpoint(event.target.value))}
        >
          <option value="chat">{copy.chatCompletions}</option>
          <option value="responses">{copy.responsesAPI}</option>
          <option value="claude">{copy.claudeMessages}</option>
          <option value="gemini">{copy.geminiGenerate}</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={modelName}
          onChange={(event) => setModelName(event.target.value)}
        >
          <option value="">{copy.selectModel}</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <div className="flex flex-wrap gap-2">
          {isAdvanced && (
            <Button variant="outline" className="gap-2" onClick={() => setIsConfigOpen(true)}>
              <Settings size={16} />
              {copy.config}
            </Button>
          )}
          <Button className="gap-2" onClick={createNewSession}>
            <MessageSquarePlus size={16} />
            {copy.newSession}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{copy.sessions}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2",
                  session.id === activeSession?.id && "border-primary bg-primary/5"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => {
                    setActiveSessionID(session.id)
                    cancelEdit()
                  }}
                >
                  <div className="truncate text-sm font-medium">{session.title || copy.untitledSession}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {copy.messageCount.replace("{count}", String(session.messages.length))}
                  </div>
                </button>
                <Button variant="ghost" size="sm" onClick={() => deleteSession(session.id)} title={copy.deleteSession}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!isAdvanced && basicConfig}

          <Card>
            <CardHeader>
              <CardTitle>{copy.conversation}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-h-[360px] space-y-3 rounded-md border p-3">
                {!activeSession || activeSession.messages.length === 0 ? (
                  <div className="py-20 text-center text-sm text-muted-foreground">{copy.noMessages}</div>
                ) : (
                  activeSession.messages.map((message) => (
                    <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div className="max-w-[92%] rounded-md border bg-background p-3 text-sm">
                        <div className="flex items-start gap-2">
                          {message.role === "user" ? (
                            <User className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <Bot className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            {editingMessageID === message.id ? (
                              <textarea
                                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                value={editingContent}
                                onChange={(event) => setEditingContent(event.target.value)}
                              />
                            ) : (
                              <div className="whitespace-pre-wrap break-words">{message.content}</div>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {editingMessageID === message.id ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={saveEditedMessage} title={copy.saveMessage}>
                                  <Check size={15} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={cancelEdit} title={copy.cancelEdit}>
                                  <X size={15} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => beginEditMessage(message)} title={copy.editMessage}>
                                  <Pencil size={15} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteMessage(message.id)} title={copy.deleteMessage}>
                                  <Trash2 size={15} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <textarea
                  className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  placeholder={copy.promptPlaceholder}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <Button className="gap-2 self-end" disabled={!prompt.trim() || isSending} onClick={sendMessage}>
                  <Send size={16} />
                  {isSending ? copy.sending : copy.send}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdvanced && (
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{copy.advancedConfig}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{copy.apiKey}</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedAPIKey?.id || ""}
                    onChange={(event) => setSelectedAPIKeyID(Number(event.target.value) || 0)}
                  >
                    <option value="">{selectableAPIKeys.length ? copy.selectKey : copy.noKeys}</option>
                    {selectableAPIKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name || key.key_prefix}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{copy.endpoint}</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={endpointMode}
                    onChange={(event) => setEndpointMode(normalizeEndpoint(event.target.value))}
                  >
                    <option value="chat">{copy.chatCompletions}</option>
                    <option value="responses">{copy.responsesAPI}</option>
                    <option value="claude">{copy.claudeMessages}</option>
                    <option value="gemini">{copy.geminiGenerate}</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium">{copy.agent}</div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/chat/agents">{copy.manageAgents}</Link>
                  </Button>
                </div>
                <div className="grid gap-2">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={selectedAgent?.id || ""}
                    onChange={(event) => handleAgentSelection(event.target.value)}
                  >
                    <option value="">{agents.length ? copy.selectAgent : copy.noAgents}</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedAgent?.prompt && (
                  <div className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {selectedAgent.prompt}
                  </div>
                )}
              </div>

              <label className="space-y-1 text-sm">
                <span className="font-medium">{copy.sessionModel}</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={activeModelName}
                  onChange={(event) => handleSessionModelChange(event.target.value)}
                >
                  <option value="">{copy.selectModel}</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsConfigOpen(false)}>{copy.done}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function readStoredSessions(storeKey = sessionsStoreKey, includeLegacy = true): ChatSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(storeKey) || "[]")
    const sessions = Array.isArray(value) ? value.map(normalizeSession).filter((session): session is ChatSession => Boolean(session)) : []
    if (sessions.length > 0) {
      return sessions
    }
  } catch {
    // Ignore invalid browser storage and fall back to a new session.
  }

  const legacyMessages = includeLegacy ? readLegacyMessages() : []
  if (legacyMessages.length > 0) {
    const now = new Date().toISOString()
    return [{ id: createID(), title: "", messages: legacyMessages, created_at: now, updated_at: now }]
  }
  return [createSession()]
}

function readLegacyMessages(): ChatMessage[] {
  try {
    const value = JSON.parse(localStorage.getItem(legacyMessagesStoreKey) || "[]")
    return Array.isArray(value) ? value.map(normalizeMessage).filter((message): message is ChatMessage => Boolean(message)) : []
  } catch {
    return []
  }
}

function readStoredEndpoint(storeKey = endpointStoreKey): ChatEndpoint {
  return normalizeEndpoint(localStorage.getItem(storeKey) || "chat")
}

function normalizeEndpoint(value: string): ChatEndpoint {
  if (value === "responses" || value === "claude" || value === "gemini") {
    return value
  }
  return "chat"
}

function chatRequest(endpoint: ChatEndpoint, modelName: string, apiKey: string, messages: ChatMessage[], systemPrompt: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (endpoint === "gemini") {
    return {
      url: `/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers,
      body: chatRequestPayload(endpoint, modelName, messages, systemPrompt),
    }
  }
  if (endpoint === "claude") {
    headers["x-api-key"] = apiKey
    return {
      url: "/v1/messages",
      headers,
      body: chatRequestPayload(endpoint, modelName, messages, systemPrompt),
    }
  }
  headers.Authorization = `Bearer ${apiKey}`
  return {
    url: endpoint === "responses" ? "/v1/responses" : "/v1/chat/completions",
    headers,
    body: chatRequestPayload(endpoint, modelName, messages, systemPrompt),
  }
}

function chatRequestPayload(endpoint: ChatEndpoint, modelName: string, messages: ChatMessage[], systemPrompt: string) {
  const prompt = systemPrompt.trim()
  if (endpoint === "responses") {
    return {
      model: modelName,
      input: [
        ...(prompt ? [{ role: "system", content: prompt }] : []),
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }
  }
  if (endpoint === "claude") {
    return {
      model: modelName,
      max_tokens: 1024,
      ...(prompt ? { system: prompt } : {}),
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    }
  }
  if (endpoint === "gemini") {
    return {
      ...(prompt ? { systemInstruction: { parts: [{ text: prompt }] } } : {}),
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    }
  }
  return {
    model: modelName,
    messages: [
      ...(prompt ? [{ role: "system", content: prompt }] : []),
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ],
  }
}

function responseTextFromPayload(payload: any): string {
  const chatText = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text
  if (typeof chatText === "string") {
    return chatText
  }
  if (typeof payload?.output_text === "string") {
    return payload.output_text
  }
  if (Array.isArray(payload?.content)) {
    const claudeText = payload.content
      .map((item: any) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim()
    if (claudeText) {
      return claudeText
    }
  }
  if (Array.isArray(payload?.candidates)) {
    const geminiText = payload.candidates
      .flatMap((candidate: any) => {
        const parts = isRecord(candidate?.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : []
        return parts.map((part: any) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      })
      .filter(Boolean)
      .join("\n")
      .trim()
    if (geminiText) {
      return geminiText
    }
  }

  const texts: string[] = []
  const output = Array.isArray(payload?.output) ? payload.output : []
  for (const item of output) {
    if (!isRecord(item)) {
      continue
    }
    if (typeof item.text === "string") {
      texts.push(item.text)
    }
    if (typeof item.content === "string") {
      texts.push(item.content)
    }
    if (Array.isArray(item.content)) {
      for (const content of item.content) {
        if (!isRecord(content)) {
          continue
        }
        if (typeof content.text === "string") {
          texts.push(content.text)
        } else if (typeof content.output_text === "string") {
          texts.push(content.output_text)
        }
      }
    }
  }
  return texts.join("\n").trim()
}

function normalizeSession(value: unknown): ChatSession | null {
  if (!isRecord(value)) {
    return null
  }
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((message): message is ChatMessage => Boolean(message))
    : []
  return {
    id: typeof value.id === "string" && value.id ? value.id : createID(),
    title: typeof value.title === "string" ? value.title : "",
    messages,
    agent_id: stringFromUnknown(value.agent_id),
    model_name: stringFromUnknown(value.model_name),
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
  }
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null
  }
  if (value.role !== "user" && value.role !== "assistant") {
    return null
  }
  if (typeof value.content !== "string") {
    return null
  }
  return {
    id: typeof value.id === "string" && value.id ? value.id : createID(),
    role: value.role,
    content: value.content,
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
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

function createSession(input: { agentID?: string; modelName?: string } = {}): ChatSession {
  const now = new Date().toISOString()
  return {
    id: createID(),
    title: "",
    messages: [],
    agent_id: input.agentID || undefined,
    model_name: input.modelName || undefined,
    created_at: now,
    updated_at: now,
  }
}

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: createID(), role, content, created_at: new Date().toISOString() }
}

function createID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function titleFromMessage(content: string, copy: typeof zhCopy) {
  const title = content.replace(/\s+/g, " ").trim()
  return title ? title.slice(0, 28) : copy.untitledSession
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

function normalizeAPIKey(value: unknown): APIKey {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    api_key: typeof item.api_key === "string" ? item.api_key : "",
    key_prefix: typeof item.key_prefix === "string" ? item.key_prefix : "",
    allowed_models: Array.isArray(item.allowed_models)
      ? item.allowed_models.filter((model): model is string => typeof model === "string")
      : [],
    enabled: Boolean(item.enabled),
  }
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

const zhCopy = {
  title: "聊天",
  sessions: "会话",
  newSession: "新会话",
  untitledSession: "新会话",
  messageCount: "{count} 条消息",
  deleteSession: "删除会话",
  config: "配置",
  advancedConfig: "高级聊天配置",
  apiKey: "令牌",
  endpoint: "接口",
  agent: "智能体",
  noAgentSelected: "未选择智能体",
  selectAgent: "选择智能体",
  noAgents: "暂无智能体",
  manageAgents: "管理智能体",
  newAgent: "新建智能体",
  editAgent: "编辑",
  deleteAgent: "删除",
  agentName: "智能体名称",
  defaultAgentName: "默认智能体",
  agentPrompt: "提示词",
  agentPromptPlaceholder: "输入这个智能体的系统提示词",
  agentDefaultModel: "默认模型",
  saveAgent: "保存智能体",
  agentSaved: "智能体已保存",
  agentDeleted: "智能体已删除",
  agentNameRequired: "请输入智能体名称",
  agentDefaultModelRequired: "请选择智能体默认模型",
  agentSaveFailed: "保存智能体失败",
  agentDeleteFailed: "删除智能体失败",
  sessionModel: "会话模型",
  done: "完成",
  chatCompletions: "Chat Completions",
  responsesAPI: "Responses",
  claudeMessages: "Claude Messages",
  geminiGenerate: "Gemini GenerateContent",
  selectKey: "选择令牌",
  noKeys: "没有可用令牌",
  selectModel: "选择模型",
  conversation: "对话",
  noMessages: "暂无对话",
  promptPlaceholder: "输入消息",
  send: "发送",
  sending: "发送中",
  editMessage: "编辑消息",
  deleteMessage: "删除消息",
  saveMessage: "保存消息",
  cancelEdit: "取消编辑",
  keyRequired: "请选择令牌",
  modelRequired: "请选择模型",
  sendFailed: "发送失败",
  emptyResponse: "空响应",
}

const enCopy: typeof zhCopy = {
  title: "Chat",
  sessions: "Sessions",
  newSession: "New chat",
  untitledSession: "New chat",
  messageCount: "{count} messages",
  deleteSession: "Delete session",
  config: "Config",
  advancedConfig: "Advanced chat config",
  apiKey: "Token",
  endpoint: "Endpoint",
  agent: "Agent",
  noAgentSelected: "No agent",
  selectAgent: "Select agent",
  noAgents: "No agents",
  manageAgents: "Manage agents",
  newAgent: "New agent",
  editAgent: "Edit",
  deleteAgent: "Delete",
  agentName: "Agent name",
  defaultAgentName: "Default agent",
  agentPrompt: "Prompt",
  agentPromptPlaceholder: "Enter this agent's system prompt",
  agentDefaultModel: "Default model",
  saveAgent: "Save agent",
  agentSaved: "Agent saved",
  agentDeleted: "Agent deleted",
  agentNameRequired: "Enter an agent name",
  agentDefaultModelRequired: "Select a default model for the agent",
  agentSaveFailed: "Failed to save agent",
  agentDeleteFailed: "Failed to delete agent",
  sessionModel: "Session model",
  done: "Done",
  chatCompletions: "Chat Completions",
  responsesAPI: "Responses",
  claudeMessages: "Claude Messages",
  geminiGenerate: "Gemini GenerateContent",
  selectKey: "Select token",
  noKeys: "No available tokens",
  selectModel: "Select model",
  conversation: "Conversation",
  noMessages: "No messages",
  promptPlaceholder: "Enter message",
  send: "Send",
  sending: "Sending",
  editMessage: "Edit message",
  deleteMessage: "Delete message",
  saveMessage: "Save message",
  cancelEdit: "Cancel edit",
  keyRequired: "Select a token first",
  modelRequired: "Select a model",
  sendFailed: "Send failed",
  emptyResponse: "Empty response",
}
