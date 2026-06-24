import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { LayoutTemplate, Plus, RotateCcw, Save, X } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { defaultWidthForPageComponent, pageComponentLabel, pageComponentPresets } from "@/components/dashboard/DashboardWidgets"
import { useToast } from "@/components/ui/toast"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import {
  DASHBOARD_PAGE_KEY,
  clonePageSlots,
  ensureEditablePageSlots,
  getPageSlotItems,
  newPageComponentItem,
  pageKeyFromPathname,
  parsePageLayouts,
  serializePageLayouts,
} from "@/lib/page-layouts"
import type { PageComponentItem, PageComponentWidth, PageLayouts, PageSlotKey } from "@/lib/page-layouts"

interface PageLayoutEditorProviderProps {
  children: ReactNode
  currentPageKey: string
  isEditing: boolean
  pageLayoutsRaw: string
  onEditingChange: (editing: boolean) => void
}

interface PageLayoutEditorContextValue {
  isEditing: boolean
  isSaving: boolean
  currentPageKey: string
  language: string
  selectedType: string
  copy: LayoutEditorCopy
  setSelectedType: (type: string) => void
  addComponent: (pageKey: string, slotKey: PageSlotKey) => void
  cancelEditing: () => void
  deleteComponent: (pageKey: string, slotKey: PageSlotKey, id: string) => void
  getItems: (pageKey: string, slotKey: PageSlotKey, defaultItems?: PageComponentItem[]) => PageComponentItem[]
  moveComponent: (pageKey: string, slotKey: PageSlotKey, index: number, direction: -1 | 1) => void
  moveComponentTo: (pageKey: string, fromSlotKey: PageSlotKey, fromIndex: number, toSlotKey: PageSlotKey, toIndex: number) => void
  resetCurrentPage: () => void
  saveEditing: () => void
  updateComponentWidth: (pageKey: string, slotKey: PageSlotKey, id: string, width: PageComponentWidth) => void
}

const PageLayoutEditorContext = createContext<PageLayoutEditorContextValue | null>(null)

const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:ring-offset-2"

export function PageLayoutEditorProvider({
  children,
  currentPageKey,
  isEditing,
  pageLayoutsRaw,
  onEditingChange,
}: PageLayoutEditorProviderProps) {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const savedLayouts = useMemo(() => parsePageLayouts(pageLayoutsRaw), [pageLayoutsRaw])
  const [draftLayouts, setDraftLayouts] = useState<PageLayouts>(savedLayouts)
  const [selectedType, setSelectedType] = useState(pageComponentPresets[0]?.type || "dashboard_stats")
  const normalizedCurrentPage = pageKeyFromPathname(currentPageKey)

  useEffect(() => {
    if (!isEditing) {
      setDraftLayouts(savedLayouts)
    }
  }, [isEditing, savedLayouts])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put("/settings", {
        page_layouts: serializePageLayouts(draftLayouts),
      })
      return res.data
    },
    onSuccess: () => {
      success(copy.saved)
      queryClient.invalidateQueries({ queryKey: ["public-settings"] })
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      onEditingChange(false)
    },
    onError: () => error(copy.saveFailed),
  })

  const value: PageLayoutEditorContextValue = {
    isEditing,
    isSaving: saveMutation.isPending,
    currentPageKey: normalizedCurrentPage,
    language,
    selectedType,
    copy,
    setSelectedType,
    addComponent: (pageKey, slotKey) => {
      updateSlot(setDraftLayouts, pageKey, slotKey, (items) => [
        ...items,
        newPageComponentItem(selectedType, defaultWidthForPageComponent(selectedType)),
      ])
    },
    cancelEditing: () => {
      setDraftLayouts(savedLayouts)
      onEditingChange(false)
    },
    deleteComponent: (pageKey, slotKey, id) => {
      updateSlot(setDraftLayouts, pageKey, slotKey, (items) => items.filter((item) => item.id !== id))
    },
    getItems: (pageKey, slotKey, defaultItems = []) => {
      const source = isEditing ? draftLayouts : savedLayouts
      const normalizedPageKey = pageKeyFromPathname(pageKey)
      if (isEditing && normalizedPageKey === DASHBOARD_PAGE_KEY) {
        const editableSlots = ensureEditablePageSlots(source, normalizedPageKey)
        return getPageSlotItems({ [normalizedPageKey]: editableSlots }, normalizedPageKey, slotKey, defaultItems)
      }
      return getPageSlotItems(source, normalizedPageKey, slotKey, defaultItems)
    },
    moveComponent: (pageKey, slotKey, index, direction) => {
      updateSlot(setDraftLayouts, pageKey, slotKey, (items) => {
        const next = [...items]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= next.length) {
          return next
        }
        const [item] = next.splice(index, 1)
        next.splice(targetIndex, 0, item)
        return next
      })
    },
    moveComponentTo: (pageKey, fromSlotKey, fromIndex, toSlotKey, toIndex) => {
      setDraftLayouts((current) => {
        const normalizedPageKey = pageKeyFromPathname(pageKey)
        const pageSlots = normalizedPageKey === DASHBOARD_PAGE_KEY
          ? ensureEditablePageSlots(current, normalizedPageKey)
          : clonePageSlots(current[normalizedPageKey])
        const fromItems = [...(pageSlots[fromSlotKey] || [])]
        if (fromIndex < 0 || fromIndex >= fromItems.length) {
          return current
        }
        const [item] = fromItems.splice(fromIndex, 1)
        const toItems = fromSlotKey === toSlotKey ? fromItems : [...(pageSlots[toSlotKey] || [])]
        const adjustedIndex = fromSlotKey === toSlotKey && fromIndex < toIndex ? toIndex - 1 : toIndex
        const boundedIndex = Math.max(0, Math.min(adjustedIndex, toItems.length))
        toItems.splice(boundedIndex, 0, item)
        pageSlots[fromSlotKey] = fromSlotKey === toSlotKey ? toItems : fromItems
        if (fromSlotKey !== toSlotKey) {
          pageSlots[toSlotKey] = toItems
        }
        return {
          ...current,
          [normalizedPageKey]: pageSlots,
        }
      })
    },
    resetCurrentPage: () => {
      setDraftLayouts((current) => {
        const next = { ...current }
        delete next[normalizedCurrentPage]
        return next
      })
    },
    saveEditing: () => saveMutation.mutate(),
    updateComponentWidth: (pageKey, slotKey, id, width) => {
      updateSlot(setDraftLayouts, pageKey, slotKey, (items) => items.map((item) => (item.id === id ? { ...item, width } : item)))
    },
  }

  return <PageLayoutEditorContext.Provider value={value}>{children}</PageLayoutEditorContext.Provider>
}

export function PageLayoutEditBar() {
  const editor = usePageLayoutEditor()
  if (!editor?.isEditing) {
    return null
  }

  const slots = slotsForPage(editor.currentPageKey, editor.copy)
  const pageLabel = pageLabelForKey(editor.currentPageKey, editor.copy)

  return (
    <div className="z-20 border-b bg-card/95 px-4 py-3 shadow-sm sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{editor.copy.visualEditing}</div>
            <div className="truncate text-xs text-muted-foreground">{pageLabel}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <select
            className={selectClass}
            value={editor.selectedType}
            aria-label={editor.copy.component}
            onChange={(event) => editor.setSelectedType(event.target.value)}
          >
            {pageComponentPresets.map((preset) => (
              <option key={preset.type} value={preset.type}>
                {pageComponentLabel(preset.type, editor.language)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Button key={slot.key} type="button" variant="outline" size="sm" className="gap-2" onClick={() => editor.addComponent(editor.currentPageKey, slot.key)}>
                <Plus className="h-4 w-4" />
                {slot.shortLabel}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={editor.resetCurrentPage}>
              <RotateCcw className="h-4 w-4" />
              {editor.copy.reset}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={editor.cancelEditing}>
              <X className="h-4 w-4" />
              {editor.copy.exit}
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={editor.saveEditing} disabled={editor.isSaving}>
              <Save className="h-4 w-4" />
              {editor.isSaving ? editor.copy.saving : editor.copy.save}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function usePageLayoutEditor() {
  return useContext(PageLayoutEditorContext)
}

function updateSlot(
  setLayouts: Dispatch<SetStateAction<PageLayouts>>,
  pageKey: string,
  slotKey: PageSlotKey,
  updater: (items: PageComponentItem[]) => PageComponentItem[]
) {
  setLayouts((current) => {
    const normalizedPageKey = pageKeyFromPathname(pageKey)
    const pageSlots = normalizedPageKey === DASHBOARD_PAGE_KEY
      ? ensureEditablePageSlots(current, normalizedPageKey)
      : clonePageSlots(current[normalizedPageKey])
    pageSlots[slotKey] = updater([...(pageSlots[slotKey] || [])])
    return {
      ...current,
      [normalizedPageKey]: pageSlots,
    }
  })
}

function slotsForPage(pageKey: string, copy: LayoutEditorCopy): Array<{ key: PageSlotKey; label: string; shortLabel: string }> {
  const baseSlots: Array<{ key: PageSlotKey; label: string; shortLabel: string }> = [
    { key: "before", label: copy.positionBefore, shortLabel: copy.addBefore },
    { key: "after", label: copy.positionAfter, shortLabel: copy.addAfter },
  ]
  if (pageKeyFromPathname(pageKey) !== DASHBOARD_PAGE_KEY) {
    return baseSlots
  }
  return [{ key: "main", label: copy.positionMain, shortLabel: copy.addMain }, ...baseSlots]
}

function pageLabelForKey(pageKey: string, copy: LayoutEditorCopy) {
  const match = pageChoices(copy).find((page) => page.key === pageKeyFromPathname(pageKey))
  return match?.label || pageKey
}

function pageChoices(copy: LayoutEditorCopy) {
  return [
    { key: "/dashboard", label: copy.pageDashboard },
    { key: "/dashboard/data-board", label: copy.pageDataBoard },
    { key: "/dashboard/logs", label: copy.pageLogs },
    { key: "/dashboard/wallet", label: copy.pageWallet },
    { key: "/dashboard/api-keys", label: copy.pageApiKeys },
    { key: "/dashboard/chat", label: copy.pageChat },
    { key: "/dashboard/images", label: copy.pageImages },
    { key: "/dashboard/settings", label: copy.pageSettings },
    { key: "/dashboard/admin-overview", label: copy.pageAdminOverview },
    { key: "/dashboard/admin/general", label: copy.pageSystem },
    { key: "/dashboard/admin/auth", label: copy.pageSystem },
    { key: "/dashboard/admin/content", label: copy.pageSystem },
    { key: "/dashboard/admin/operations", label: copy.pageSystem },
    { key: "/dashboard/admin/advanced-chat", label: copy.pageSystem },
    { key: "/dashboard/channels", label: copy.pageChannels },
    { key: "/dashboard/models", label: copy.pageModels },
    { key: "/dashboard/users", label: copy.pageUsers },
  ]
}

interface LayoutEditorCopy {
  addAfter: string
  addBefore: string
  addComponent: string
  addMain: string
  component: string
  delete: string
  emptySlot: string
  exit: string
  moveDown: string
  moveUp: string
  pageAdminOverview: string
  pageApiKeys: string
  pageChannels: string
  pageChat: string
  pageDashboard: string
  pageDataBoard: string
  pageImages: string
  pageLogs: string
  pageModels: string
  pageSettings: string
  pageSystem: string
  pageUsers: string
  pageWallet: string
  positionAfter: string
  positionBefore: string
  positionMain: string
  reset: string
  save: string
  saved: string
  saveFailed: string
  saving: string
  visualEditing: string
  width: string
  widthFull: string
  widthHalf: string
  widthThird: string
}

const zhCopy: LayoutEditorCopy = {
  addAfter: "插到下方",
  addBefore: "插到上方",
  addComponent: "添加组件",
  addMain: "插到首页",
  component: "预设组件",
  delete: "删除",
  emptySlot: "点击添加，把选中的组件插到这里",
  exit: "退出",
  moveDown: "下移",
  moveUp: "上移",
  pageAdminOverview: "管理员概览",
  pageApiKeys: "API 密钥",
  pageChannels: "渠道",
  pageChat: "聊天",
  pageDashboard: "首页概览",
  pageDataBoard: "数据看板",
  pageImages: "AI 绘画",
  pageLogs: "明细",
  pageModels: "模型",
  pageSettings: "设置",
  pageSystem: "系统设置",
  pageUsers: "用户",
  pageWallet: "钱包",
  positionAfter: "内容下方",
  positionBefore: "内容上方",
  positionMain: "首页主体",
  reset: "重置本页",
  save: "保存",
  saved: "页面组件已保存",
  saveFailed: "页面组件保存失败",
  saving: "保存中",
  visualEditing: "可视化编辑",
  width: "宽度",
  widthFull: "整行",
  widthHalf: "半行",
  widthThird: "三分之一",
}

const enCopy: LayoutEditorCopy = {
  addAfter: "Add below",
  addBefore: "Add above",
  addComponent: "Add component",
  addMain: "Add to dashboard",
  component: "Preset component",
  delete: "Delete",
  emptySlot: "Click add to place the selected component here",
  exit: "Exit",
  moveDown: "Move down",
  moveUp: "Move up",
  pageAdminOverview: "Admin overview",
  pageApiKeys: "API keys",
  pageChannels: "Channels",
  pageChat: "Chat",
  pageDashboard: "Dashboard",
  pageDataBoard: "Data board",
  pageImages: "AI images",
  pageLogs: "Details",
  pageModels: "Models",
  pageSettings: "Settings",
  pageSystem: "System settings",
  pageUsers: "Users",
  pageWallet: "Wallet",
  positionAfter: "Below content",
  positionBefore: "Above content",
  positionMain: "Dashboard body",
  reset: "Reset page",
  save: "Save",
  saved: "Page components saved",
  saveFailed: "Failed to save page components",
  saving: "Saving",
  visualEditing: "Visual editing",
  width: "Width",
  widthFull: "Full row",
  widthHalf: "Half row",
  widthThird: "One third",
}
