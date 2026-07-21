import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";
import { useCategories } from "@/hooks/useCategories";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useFieldControlProps } from "@/components/ui/form-field";
import { Popover } from "@base-ui/react/popover";
import { translateSystemLabel } from "@/i18n/translate-system-label";

export interface CategorySelectorProps {
  workspaceId: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface VisibleItem {
  id: string;
  name: string;
  isParent: boolean;
  displayPath: string;
}

function buildVisibleItems(
  categories: Category[],
  search: string,
): VisibleItem[] {
  const q = search.toLowerCase().trim();
  const items: VisibleItem[] = [];

  for (const parent of categories) {
    const parentMatches = !q || parent.name.toLowerCase().includes(q);
    const matchingChildren = parent.children.filter((child) =>
      child.name.toLowerCase().includes(q),
    );

    if (!parentMatches && matchingChildren.length === 0) continue;

    items.push({
      id: parent.id,
      name: parent.name,
      isParent: true,
      displayPath: parent.name,
    });

    const childrenToShow = parentMatches ? parent.children : matchingChildren;
    for (const child of childrenToShow) {
      items.push({
        id: child.id,
        name: child.name,
        isParent: false,
        displayPath: `${parent.name} → ${child.name}`,
      });
    }
  }

  return items;
}

function findDisplayPath(categories: Category[], id: string): string | null {
  for (const parent of categories) {
    if (parent.id === id) return parent.name;
    for (const child of parent.children) {
      if (child.id === id) return `${parent.name} → ${child.name}`;
    }
  }
  return null;
}

export function CategorySelector({
  workspaceId,
  value,
  onChange,
  placeholder,
  disabled = false,
}: CategorySelectorProps) {
  const field = useFieldControlProps();
  const { t } = useTranslation();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { categories, isLoading, error, retry } = useCategories(workspaceId);
  const localizedCategories = useMemo(
    () =>
      categories.map((parent) => ({
        ...parent,
        name: translateSystemLabel(t, parent.systemKey, parent.name),
        children: parent.children.map((child) => ({
          ...child,
          name: translateSystemLabel(t, child.systemKey, child.name),
        })),
      })),
    [categories, t],
  );
  const visibleItems = buildVisibleItems(localizedCategories, search);
  const displayPath = value
    ? findDisplayPath(localizedCategories, value)
    : null;

  function closeDropdown() {
    setOpen(false);
    setSearch("");
    setFocusedIndex(-1);
  }

  function selectItem(id: string) {
    onChange(id);
    closeDropdown();
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-index="${focusedIndex}"]`,
    );
    item?.scrollIntoView?.({ block: "nearest" });
  }, [focusedIndex]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
        selectItem(visibleItems[focusedIndex].id);
      }
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setSearch("");
        setFocusedIndex(-1);
      }}
    >
      <Popover.Trigger
        id={field?.controlId}
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        disabled={disabled}
        onKeyDown={(event) => {
          if (!open && event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={buttonVariants({
          variant: "outline",
          className: cn(
            "h-10 w-full justify-between gap-2 px-3 font-normal",
            !displayPath && "text-muted-foreground",
          ),
        })}
      >
        <span className="truncate">
          {displayPath ?? placeholder ?? t("transactions.chooseCategory")}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          sideOffset={4}
          align="start"
          className="z-[90] outline-none"
        >
          <Popover.Popup
            initialFocus={searchRef}
            data-slot="category-dropdown"
            className="flex max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg outline-none"
          >
            <div className="border-b border-border p-2">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("transactions.searchCategories")}
                aria-label={t("transactions.searchCategoriesLabel")}
                className="w-full bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <ul
              id={listboxId}
              ref={listRef}
              role="listbox"
              aria-label={t("transactions.categories")}
              className="min-h-0 overflow-y-auto py-1"
            >
              {isLoading ? (
                <li>
                  <StateMessage variant="loading" className="py-2">
                    {t("common.loading")}
                  </StateMessage>
                </li>
              ) : error ? (
                <li>
                  <Alert
                    variant="error"
                    compact
                    className="rounded-none border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{error}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void retry()}
                      >
                        {t("common.retry")}
                      </Button>
                    </div>
                  </Alert>
                </li>
              ) : visibleItems.length === 0 ? (
                <li>
                  <StateMessage className="py-2">
                    {t("transactions.noResults")}
                  </StateMessage>
                </li>
              ) : (
                visibleItems.map((item, index) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={item.id === value}
                    data-index={index}
                    onClick={() => selectItem(item.id)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 py-1.5 text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      focusedIndex === index &&
                        "bg-accent text-accent-foreground",
                      item.isParent
                        ? "px-3 font-semibold"
                        : "pr-3 pl-8 font-normal",
                    )}
                  >
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.id === value && (
                      <Check className="size-3.5 shrink-0" />
                    )}
                  </li>
                ))
              )}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
