import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DragEvent, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { PageComponent, pageComponentLabel, pageComponentPresets } from "@/components/dashboard/DashboardWidgets"
import { usePageLayoutEditor } from "@/components/layout/PageLayoutEditor"
import api from "@/lib/api"
import { DASHBOARD_PAGE_KEY, getPageSlotItems, pageKeyFromPathname, parsePageLayouts } from "@/lib/page-layouts"
import type { PageComponentItem, PageComponentWidth, PageSlotKey } from "@/lib/page-layouts"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"
import { cn } from "@/lib/utils"

interface PageComponentSlotsProps {
  pageKey: string
  slotKey: PageSlotKey
  defaultItems?: PageComponentItem[]
  className?: string
}

const widthClasses: Record<PageComponentWidth, string> = {
  full: "lg:col-span-6",
  half: "lg:col-span-3",
  third: "lg:col-span-2",
}

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
const componentDragType = "application/x-flai-page-component"

export function PageComponentSlots({ pageKey, slotKey, defaultItems = [], className }: PageComponentSlotsProps) {
  const editor = usePageLayoutEditor()
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
    enabled: !editor?.isEditing,
  })
  const publicSettings = withPublicSettingsDefaults(settings)
  const normalizedPageKey = pageKeyFromPathname(pageKey)
  const savedItems = getPageSlotItems(parsePageLayouts(publicSettings.page_layouts), normalizedPageKey, slotKey, defaultItems)
  const items = (editor?.isEditing ? editor.getItems(normalizedPageKey, slotKey, defaultItems) : savedItems).filter((item) =>
    pageComponentPresets.some((preset) => preset.type === item.type)
  )

  if (!editor?.isEditing && items.length === 0) {
    return null
  }

  if (editor?.isEditing) {
    return (
      <EditableSlot
        className={className}
        editor={editor}
        items={items}
        pageKey={normalizedPageKey}
        slotKey={slotKey}
      />
    )
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-6", className)}>
      {items.map((item) => (
        <div key={item.id} className={cn("min-w-0", widthClasses[item.width || "half"])}>
          <PageComponent type={item.type} />
        </div>
      ))}
    </div>
  )
}

function EditableSlot({
  className,
  editor,
  items,
  pageKey,
  slotKey,
}: {
  className?: string
  editor: NonNullable<ReturnType<typeof usePageLayoutEditor>>
  items: PageComponentItem[]
  pageKey: string
  slotKey: PageSlotKey
}) {
  const label = slotLabel(pageKey, slotKey, editor.copy)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  return (
    <section
      className={cn("rounded-md border border-dashed border-primary/40 bg-primary/5 p-3", className)}
      onDragOver={(event) => {
        if (hasComponentDragData(event)) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        const source = readComponentDragData(event)
        if (!source || source.pageKey !== pageKey) {
          return
        }
        event.preventDefault()
        editor.moveComponentTo(pageKey, source.slotKey, source.index, slotKey, items.length)
        setDragOverIndex(null)
      }}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{pageComponentLabel(editor.selectedType, editor.language)}</div>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => editor.addComponent(pageKey, slotKey)}>
          <Plus className="h-4 w-4" />
          {editor.copy.addComponent}
        </Button>
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          className="flex min-h-20 w-full items-center justify-center rounded-md border border-dashed bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-background"
          onClick={() => editor.addComponent(pageKey, slotKey)}
        >
          {editor.copy.emptySlot}
        </button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-6">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              className={cn("min-w-0 cursor-grab active:cursor-grabbing", widthClasses[item.width || "half"])}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData(componentDragType, JSON.stringify({ pageKey, slotKey, index }))
              }}
              onDragOver={(event) => {
                if (hasComponentDragData(event)) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDragOverIndex(index)
                }
              }}
              onDragLeave={() => setDragOverIndex((current) => (current === index ? null : current))}
              onDragEnd={() => setDragOverIndex(null)}
              onDrop={(event) => {
                const source = readComponentDragData(event)
                if (!source || source.pageKey !== pageKey) {
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                editor.moveComponentTo(pageKey, source.slotKey, source.index, slotKey, index)
                setDragOverIndex(null)
              }}
            >
              <div className={cn("rounded-md border bg-background p-2 shadow-sm", dragOverIndex === index && "ring-2 ring-primary")}>
                <div className="mb-2 flex flex-col gap-2 rounded-md bg-muted/70 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-xs font-medium">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-background">{index + 1}</span>
                    <span>{pageComponentLabel(item.type, editor.language)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={selectClass}
                      value={item.width || "half"}
                      aria-label={editor.copy.width}
                      onChange={(event) => editor.updateComponentWidth(pageKey, slotKey, item.id, event.target.value as PageComponentWidth)}
                    >
                      <option value="full">{editor.copy.widthFull}</option>
                      <option value="half">{editor.copy.widthHalf}</option>
                      <option value="third">{editor.copy.widthThird}</option>
                    </select>
                    <IconButton label={editor.copy.moveUp} disabled={index === 0} onClick={() => editor.moveComponent(pageKey, slotKey, index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={editor.copy.moveDown} disabled={index === items.length - 1} onClick={() => editor.moveComponent(pageKey, slotKey, index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={editor.copy.delete} className="text-red-500 hover:text-red-600" onClick={() => editor.deleteComponent(pageKey, slotKey, item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="pointer-events-none">
                  <PageComponent type={item.type} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function IconButton({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button type="button" variant="outline" size="icon" className={cn("h-8 w-8", className)} disabled={disabled} title={label} aria-label={label} onClick={onClick}>
      {children}
    </Button>
  )
}

function slotLabel(pageKey: string, slotKey: PageSlotKey, copy: NonNullable<ReturnType<typeof usePageLayoutEditor>>["copy"]) {
  if (pageKeyFromPathname(pageKey) === DASHBOARD_PAGE_KEY && slotKey === "main") {
    return copy.positionMain
  }
  if (slotKey === "before") {
    return copy.positionBefore
  }
  if (slotKey === "after") {
    return copy.positionAfter
  }
  return copy.positionMain
}

function hasComponentDragData(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes(componentDragType)
}

function readComponentDragData(event: DragEvent) {
  const raw = event.dataTransfer.getData(componentDragType)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as { pageKey?: string; slotKey?: PageSlotKey; index?: number }
    if (!parsed.pageKey || !parsed.slotKey || typeof parsed.index !== "number") {
      return null
    }
    return {
      pageKey: pageKeyFromPathname(parsed.pageKey),
      slotKey: parsed.slotKey,
      index: parsed.index,
    }
  } catch {
    return null
  }
}
