import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { buttonVariants } from "@monqom/ui";
import { useCategories } from "@/hooks/useCategories";
import {
  useCategoryMutations,
  type CategoryInput,
} from "@/hooks/useCategoryMutations";
import type { Category } from "@/types/category";
import {
  Alert,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  FormField,
  Input,
  Modal,
  PendingButton,
  SectionCard,
  Select,
} from "@monqom/ui";

type DialogState = { category: Category | null; parentId?: string } | null;
type CategoryKind = "group" | "subcategory";
type CategoryFlow = "expense" | "income";

const SUGGESTED_EMOJIS = [
  "🛒",
  "🍽️",
  "🏠",
  "🚗",
  "💳",
  "💡",
  "🎓",
  "🏋️",
  "🐾",
  "✈️",
  "🎮",
  "🧾",
];

export function CategoryManagementSection({
  workspaceId,
  onSaved,
}: {
  workspaceId: string | null;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [categoryType, setCategoryType] = useState<CategoryFlow>("expense");
  const [tab, setTab] = useState<"active" | "hidden">("active");
  const { categories, isLoading, error, retry } = useCategories(
    workspaceId ?? "",
    true,
    categoryType,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [target, setTarget] = useState<Category | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const mutations = useCategoryMutations(workspaceId ?? "");
  const visible = categories.filter((category) =>
    tab === "hidden" ? category.isArchived : !category.isArchived,
  );

  async function hide() {
    if (!target) return;
    setPending(true);
    setActionError(null);
    try {
      await mutations.hide.mutateAsync(target.id);
      setTarget(null);
      onSaved(t("categoryManagement.hideSuccess"));
    } catch {
      setActionError(t("categoryManagement.hideError"));
    } finally {
      setPending(false);
    }
  }

  async function restore(category: Category) {
    setPending(true);
    setActionError(null);
    try {
      await mutations.restore.mutateAsync(category.id);
      onSaved(t("categoryManagement.restoreSuccess"));
    } catch {
      setActionError(t("categoryManagement.restoreError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {t("categoryManagement.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("categoryManagement.description")}
          </p>
        </div>
        <Button
          onClick={() => setDialog({ category: null })}
          disabled={!workspaceId}
        >
          <Plus size={16} aria-hidden="true" />
          {t("categoryManagement.add")}
        </Button>
      </div>

      <div
        className="mt-5 flex gap-2"
        role="group"
        aria-label={t("categoryManagement.type")}
      >
        {(["expense", "income"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={categoryType === value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryType(value)}
          >
            {t(
              value === "expense"
                ? "categoryManagement.expenses"
                : "categoryManagement.income",
            )}
          </Button>
        ))}
      </div>
      <div
        className="mt-3 flex gap-2"
        role="tablist"
        aria-label={t("categoryManagement.title")}
      >
        {(["active", "hidden"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? "default" : "outline"}
            size="sm"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {t(
              value === "active"
                ? "categoryManagement.active"
                : "categoryManagement.hiddenTab",
            )}
          </Button>
        ))}
      </div>

      {actionError && (
        <Alert variant="error" compact className="mt-4">
          {actionError}
        </Alert>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? <p>{t("common.loading")}</p> : null}
        {error ? (
          <Alert variant="error" compact>
            {error}{" "}
            <Button size="sm" variant="outline" onClick={() => void retry()}>
              {t("common.retry")}
            </Button>
          </Alert>
        ) : null}
        {!isLoading && !error && visible.length === 0 ? (
          <EmptyState
            title={t(
              tab === "active"
                ? "categoryManagement.emptyActiveTitle"
                : "categoryManagement.emptyHiddenTitle",
            )}
            description={t(
              tab === "active"
                ? "categoryManagement.emptyActiveDescription"
                : "categoryManagement.emptyHiddenDescription",
            )}
          />
        ) : null}
        {!isLoading &&
          !error &&
          visible.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              nested={false}
              onEdit={(item) => setDialog({ category: item })}
              onAddChild={(item) =>
                setDialog({ category: null, parentId: item.id })
              }
              onHide={setTarget}
              onRestore={(item) => void restore(item)}
              t={t}
            />
          ))}
      </div>

      {dialog && workspaceId ? (
        <CategoryDialog
          key={dialog.category?.id ?? dialog.parentId ?? "new-group"}
          category={dialog.category}
          defaultParentId={dialog.parentId}
          mutations={mutations}
          categoryType={categoryType}
          parents={categories.filter((item) => !item.isArchived)}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onSaved(t("categoryManagement.saveSuccess"));
          }}
        />
      ) : null}
      {target ? (
        <ConfirmationDialog
          open
          title={t("categoryManagement.hideTitle")}
          description={
            target.children.length
              ? t("categoryManagement.hideGroupDescription", {
                  count: target.children.length,
                })
              : t("categoryManagement.hideDescription")
          }
          confirmLabel={t("categoryManagement.hide")}
          cancelLabel={t("common.cancel")}
          pendingLabel={t("common.loading")}
          isPending={pending}
          error={actionError}
          onClose={() => {
            if (!pending) setTarget(null);
          }}
          onConfirm={() => void hide()}
        />
      ) : null}
    </SectionCard>
  );
}

function CategoryRow({
  category,
  nested,
  onEdit,
  onAddChild,
  onHide,
  onRestore,
  t,
}: {
  category: Category;
  nested: boolean;
  onEdit: (category: Category) => void;
  onAddChild?: (category: Category) => void;
  onHide: (category: Category) => void;
  onRestore: (category: Category) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = translateSystemLabel(t, category.systemKey, category.name);
  return (
    <div className={nested ? "ml-4 border-l border-border/70 pl-3" : ""}>
      <Card
        padding="compact"
        tone="transparent"
        className="flex items-center justify-between gap-3"
      >
        <div>
          <p className="font-medium">
            {category.icon ? `${category.icon} ` : ""}
            {label}
          </p>
          <p className="text-sm text-muted-foreground">
            {category.isArchived
              ? t("categoryManagement.hidden")
              : !nested
                ? t("categoryManagement.childrenCount", {
                    count: category.children.length,
                  })
                : t("categoryManagement.subcategory")}
          </p>
        </div>
        <Menu.Root modal={false}>
          <Menu.Trigger
            aria-label={t("categoryManagement.actions")}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <MoreHorizontal size={19} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              sideOffset={4}
              align="end"
              className="z-[100] outline-none"
            >
              <Menu.Popup className="min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                {category.isArchived ? (
                  <Menu.Item
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                    onClick={() => onRestore(category)}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    {t("categoryManagement.restore")}
                  </Menu.Item>
                ) : (
                  <>
                    <Menu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                      onClick={() => onEdit(category)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      {t("common.edit")}
                    </Menu.Item>
                    {!nested && onAddChild ? (
                      <Menu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                        onClick={() => onAddChild(category)}
                      >
                        <Plus size={15} aria-hidden="true" />
                        {t("categoryManagement.addSubcategory")}
                      </Menu.Item>
                    ) : null}
                    <Menu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                      onClick={() => onHide(category)}
                    >
                      <EyeOff size={15} aria-hidden="true" />
                      {t("categoryManagement.hide")}
                    </Menu.Item>
                  </>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Card>
      {!category.isArchived && !nested && category.children.length ? (
        <div className="mt-2 space-y-2">
          {category.children.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              nested
              onEdit={onEdit}
              onHide={onHide}
              onRestore={onRestore}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryDialog({
  category,
  defaultParentId,
  mutations,
  categoryType,
  parents,
  onClose,
  onSaved,
}: {
  category: Category | null;
  defaultParentId?: string;
  mutations: ReturnType<typeof useCategoryMutations>;
  categoryType: CategoryFlow;
  parents: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [parentId, setParentId] = useState(
    category?.parentId ?? defaultParentId ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const kind: CategoryKind = parentId ? "subcategory" : "group";
  const nameError = submitted ? validateName(name, t) : null;
  const iconError = submitted ? validateIcon(icon, t) : null;
  const parentOptions = useMemo(
    () => parents.filter((parent) => parent.id !== category?.id),
    [category?.id, parents],
  );

  function chooseKind(nextKind: CategoryKind) {
    setParentId(nextKind === "group" ? "" : (parentOptions[0]?.id ?? ""));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextNameError = validateName(name, t);
    const nextIconError = validateIcon(icon, t);
    if (nextNameError || nextIconError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: CategoryInput = {
        name: name.trim(),
        icon: icon.trim() || null,
        parent_id: parentId || null,
        ...(!category ? { type: categoryType } : {}),
      };
      if (category)
        await mutations.update.mutateAsync({ id: category.id, input: body });
      else await mutations.create.mutateAsync(body);
      onSaved();
    } catch {
      setSaveError(t("categoryManagement.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={saving}
      ariaLabelledBy="category-dialog-title"
      contentClassName="max-w-lg"
    >
      <div className="border-b pb-4">
        <h2 id="category-dialog-title" className="text-xl font-semibold">
          {t(category ? "categoryManagement.edit" : "categoryManagement.add")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("categoryManagement.formDescription")}
        </p>
      </div>
      <form className="space-y-6 pt-5" onSubmit={submit} noValidate>
        <FormField
          id="category-name"
          label={t("categoryManagement.name")}
          error={nameError ?? undefined}
          required
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("categoryManagement.namePlaceholder")}
            autoFocus
            maxLength={100}
            aria-invalid={Boolean(nameError)}
          />
        </FormField>
        <fieldset>
          <legend className="text-sm font-medium">
            {t("categoryManagement.kind")}
          </legend>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("categoryManagement.kindDescription")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <KindChoice
              checked={kind === "group"}
              title={t("categoryManagement.group")}
              description={t("categoryManagement.groupHint")}
              onClick={() => chooseKind("group")}
            />
            <KindChoice
              checked={kind === "subcategory"}
              title={t("categoryManagement.subcategory")}
              description={t("categoryManagement.subcategoryHint")}
              onClick={() => chooseKind("subcategory")}
            />
          </div>
        </fieldset>
        {kind === "subcategory" ? (
          <FormField
            id="category-parent"
            label={t("categoryManagement.parent")}
            required
          >
            <Select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              disabled={!parentOptions.length}
            >
              {parentOptions.length ? (
                parentOptions.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.icon ? `${parent.icon} ` : ""}
                    {translateSystemLabel(t, parent.systemKey, parent.name)}
                  </option>
                ))
              ) : (
                <option value="">
                  {t("categoryManagement.noParentAvailable")}
                </option>
              )}
            </Select>
          </FormField>
        ) : null}
        <EmojiPicker value={icon} onChange={setIcon} error={iconError} />
        <div aria-live="polite">
          {saveError ? (
            <Alert variant="error" compact>
              {saveError}
            </Alert>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <PendingButton
            type="submit"
            isPending={saving}
            pendingLabel={t("settings.saving")}
          >
            {t("common.save")}
          </PendingButton>
        </div>
      </form>
    </Modal>
  );
}

function KindChoice({
  checked,
  title,
  description,
  onClick,
}: {
  checked: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60"}`}
      aria-pressed={checked}
    >
      <span className="flex items-center gap-2 font-medium">
        {checked ? (
          <Check size={16} className="text-primary" aria-hidden="true" />
        ) : (
          <span
            className="size-4 rounded-full border border-muted-foreground"
            aria-hidden="true"
          />
        )}
        {title}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function EmojiPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  return (
    <FormField
      id="category-icon"
      label={t("categoryManagement.icon")}
      error={error ?? undefined}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {t("categoryManagement.iconHint")}
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="list"
        aria-label={t("categoryManagement.iconSuggestions")}
      >
        {SUGGESTED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`flex size-10 items-center justify-center rounded-lg border text-xl transition-colors ${value === emoji ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted"}`}
            onClick={() => onChange(emoji)}
            aria-label={t("categoryManagement.useIcon", { icon: emoji })}
            aria-pressed={value === emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("categoryManagement.iconPlaceholder")}
          maxLength={16}
          aria-invalid={Boolean(error)}
        />
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl"
          aria-label={t("categoryManagement.iconPreview")}
        >
          {value || "✦"}
        </span>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            aria-label={t("categoryManagement.clearIcon")}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}

function validateName(name: string, t: ReturnType<typeof useTranslation>["t"]) {
  const normalized = name.trim();
  if (!normalized) return t("categoryManagement.nameRequired");
  if (normalized.length > 100) return t("categoryManagement.nameTooLong");
  return null;
}

function validateIcon(icon: string, t: ReturnType<typeof useTranslation>["t"]) {
  const normalized = icon.trim();
  if (!normalized) return null;
  return /^\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*$/u.test(
    normalized,
  )
    ? null
    : t("categoryManagement.iconInvalid");
}
