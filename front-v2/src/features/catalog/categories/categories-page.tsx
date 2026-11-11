"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FolderPlus, FolderTree, GripVertical, MoreVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Meter } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Thumb } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { usePlanFeature, usePlanLimit } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { categoryKeys, childrenOf, MAX_DEPTH, reorderCategories, updateCategory, useCategories, useRefreshCategories, type Category } from "./api";
import { CategoryDrawer, type DrawerState } from "./category-drawer";
import { DeleteCategoryDialog } from "./delete-category";

const t = ar.catalog.categories;

export function CategoriesPage() {
  const hasStore = usePlanFeature("store");
  const limit = usePlanLimit("store_categories");
  const query = useCategories(hasStore);
  const [drawer, setDrawer] = React.useState<DrawerState>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const list = React.useMemo(() => query.data ?? [], [query.data]);
  const atLimit = limit !== null && list.length >= limit;

  const parents = list.filter((c) => list.some((k) => k.parent_id === c.id)).map((c) => c.id);
  const allOpen = collapsed.size === 0;

  const header = (
    <PageHeader
      title={t.title}
      description={t.description}
      actions={
        hasStore ? (
          <>
            {parents.length ? (
              <Button variant="outline" onClick={() => setCollapsed(allOpen ? new Set(parents) : new Set())}>
                {allOpen ? t.collapseAll : t.expandAll}
              </Button>
            ) : null}
            <Button onClick={() => setDrawer({ mode: "create", parentId: null })} disabled={atLimit}>
              <Plus />
              {t.add}
            </Button>
          </>
        ) : null
      }
    />
  );

  if (!hasStore) {
    return (
      <>
        {header}
        <LockedNotice title={t.noStore} description={t.noStoreText} />
      </>
    );
  }

  return (
    <>
      {header}
      {limit !== null && query.isSuccess ? (
        <div className="mb-4 max-w-xs">
          <Meter used={list.length} limit={limit} label={t.title} />
        </div>
      ) : null}

      {query.isPending ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={FolderTree}
            title={t.emptyTitle}
            description={t.emptyText}
            action={
              <Button onClick={() => setDrawer({ mode: "create", parentId: null })}>
                <Plus />
                {t.add}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Level
            list={list}
            parentId={null}
            collapsed={collapsed}
            onToggle={(id) => setCollapsed((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))}
            onEdit={(category) => setDrawer({ mode: "edit", category })}
            onAddChild={(category) => setDrawer({ mode: "create", parentId: category.id })}
            onDelete={setDeleting}
            canAdd={!atLimit}
          />
        </div>
      )}

      <CategoryDrawer state={drawer} onClose={() => setDrawer(null)} categories={list} />
      <DeleteCategoryDialog category={deleting} categories={list} onClose={() => setDeleting(null)} />
    </>
  );
}

type RowActions = {
  list: Category[];
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (c: Category) => void;
  onAddChild: (c: Category) => void;
  onDelete: (c: Category) => void;
  canAdd: boolean;
};

/** One level of siblings, sortable among themselves; each row holds its own children below it. */
function Level({ parentId, ...props }: RowActions & { parentId: number | null }) {
  const client = useQueryClient();
  const siblings = childrenOf(props.list, parentId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const moved = arrayMove(siblings, siblings.findIndex((c) => c.id === active.id), siblings.findIndex((c) => c.id === over.id));
    const positions = new Map(moved.map((c, i) => [c.id, i]));
    // Show the new order at once; the server confirms (or the list reloads on error).
    client.setQueryData<Category[]>(categoryKeys.all, (old) => old?.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c)));
    try {
      await reorderCategories(moved.map((c) => c.id));
      toast.success(t.reordered);
    } catch (error) {
      toast.error(errorMessage(error));
      await client.invalidateQueries({ queryKey: categoryKeys.all });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
      <SortableContext items={siblings.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn(parentId !== null && "border-t border-border bg-surface-2/40")}>
          {siblings.map((category) => (
            <Row key={category.id} category={category} {...props} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ category, ...props }: RowActions & { category: Category }) {
  const { list, collapsed, onToggle, onEdit, onAddChild, onDelete, canAdd } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const refresh = useRefreshCategories();
  const [busy, setBusy] = React.useState(false);
  const hasChildren = list.some((c) => c.parent_id === category.id);
  const open = hasChildren && !collapsed.has(category.id);
  const canNest = category.depth + 1 < MAX_DEPTH;

  async function toggleVisible(next: boolean) {
    setBusy(true);
    try {
      await updateCategory(category.id, { is_visible: next });
      toast.success(t.visibilityChanged(next));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("border-b border-border last:border-b-0", isDragging && "relative z-10 bg-surface shadow-lg")}>
      <div className="flex items-center gap-2 py-2 pe-3" style={{ paddingInlineStart: `${0.5 + category.depth * 1.75}rem` }}>
        <button type="button" className="cursor-grab rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing" aria-label={ar.media.handle} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(category.id)} aria-expanded={open} aria-label={t.toggleChildren} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink">
            <ChevronDown className={cn("size-4 transition-transform", !open && "rotate-90")} />
          </button>
        ) : (
          <span className="w-6" aria-hidden />
        )}
        <Thumb src={category.image?.thumb} size={36} />
        <button type="button" onClick={() => onEdit(category)} className="min-w-0 flex-1 text-start">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn("truncate text-sm font-semibold", !category.is_visible && "text-ink-3")}>{category.name}</span>
            {!category.is_visible ? (
              <Badge tone="neutral" size="sm">
                {t.hidden}
              </Badge>
            ) : null}
            {category.locked_by_plan ? (
              <Badge tone="warning" size="sm">
                {t.lockedByPlan}
              </Badge>
            ) : null}
          </span>
        </button>
        <Link href={`/dashboard/catalog/products?category=${category.id}`} className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink sm:inline-flex">
          <Package className="size-3.5" aria-hidden />
          {t.products(category.products_count)}
        </Link>
        <Switch checked={category.is_visible} disabled={busy} onCheckedChange={(v) => void toggleVisible(v)} aria-label={t.visible} />
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
              <MoreVertical />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => onEdit(category)}>
              <Pencil />
              {t.edit}
            </MenuItem>
            <MenuItem disabled={!canNest || !canAdd} onSelect={() => onAddChild(category)}>
              <FolderPlus />
              {canNest ? t.addChild : t.maxDepth}
            </MenuItem>
            <MenuItem asChild>
              <Link href={`/dashboard/catalog/products?category=${category.id}`}>
                <Package />
                {t.viewProducts}
              </Link>
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => onDelete(category)}>
              <Trash2 />
              {t.delete}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {open ? <Level parentId={category.id} {...props} /> : null}
    </li>
  );
}
