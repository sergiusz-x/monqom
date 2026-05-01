import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";
import { useCategories } from "@/hooks/useCategories";

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
  placeholder = "Select category",
  disabled = false,
}: CategorySelectorProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { categories, isLoading, error } = useCategories(workspaceId);
  const visibleItems = buildVisibleItems(categories, search);
  const displayPath = value ? findDisplayPath(categories, value) : null;

  function openDropdown() {
    setOpen(true);
    setSearch("");
    setFocusedIndex(-1);
  }

  function closeDropdown() {
    setOpen(false);
    setSearch("");
    setFocusedIndex(-1);
  }

  function selectItem(id: string) {
    onChange(id);
    closeDropdown();
  }

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

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
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={(e) => {
          if (
            !open &&
            (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            openDropdown();
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          !displayPath && "text-muted-foreground",
        )}
      >
        <span className="truncate">{displayPath ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="presentation"
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md"
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
              placeholder="Search categories…"
              aria-label="Search categories"
              className="w-full bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            aria-label="Categories"
            className="max-h-60 overflow-y-auto py-1"
          >
            {isLoading ? (
              <li
                className="px-3 py-2 text-sm text-muted-foreground"
                role="status"
              >
                Loading categories…
              </li>
            ) : error ? (
              <li className="px-3 py-2 text-sm text-destructive" role="alert">
                Failed to load categories
              </li>
            ) : visibleItems.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No categories found
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
                  {item.id === value && <Check className="size-3.5 shrink-0" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
