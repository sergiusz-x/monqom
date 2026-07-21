import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface TransactionTagSelectorProps {
  availableTags: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TransactionTagSelector({
  availableTags,
  value,
  onChange,
  maxTags = 10,
}: TransactionTagSelectorProps) {
  const { t } = useTranslation();
  const [newTag, setNewTag] = useState("");
  const normalizedSelected = new Set(value.map((tag) => tag.toLowerCase()));
  const selectableTags = availableTags.filter(
    (tag) => !normalizedSelected.has(tag.toLowerCase()),
  );
  const canAddMore = value.length < maxTags;

  function addTag(tag: string) {
    const normalizedTag = tag.trim();
    if (!normalizedTag || !canAddMore) return;
    const existingTag = [...availableTags, ...value].find(
      (item) => item.toLowerCase() === normalizedTag.toLowerCase(),
    );
    onChange([...value, existingTag ?? normalizedTag]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={t("transactions.removeTag", { tag })}
                onClick={() => removeTag(tag)}
              >
                <X size={12} aria-hidden="true" />
              </Button>
            </span>
          ))}
        </div>
      )}

      <Select
        value=""
        disabled={!canAddMore || selectableTags.length === 0}
        aria-label={t("transactions.selectExistingTag")}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
        onChange={(event) => addTag(event.target.value)}
      >
        <option value="">{t("transactions.selectExistingTag")}</option>
        {selectableTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </Select>

      <div className="flex gap-2">
        <Input
          value={newTag}
          disabled={!canAddMore}
          aria-label={t("transactions.newTag")}
          placeholder={t("transactions.newTagPlaceholder")}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => setNewTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(newTag);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={!canAddMore || !newTag.trim()}
          onClick={() => addTag(newTag)}
        >
          <Plus size={15} aria-hidden="true" />
          {t("transactions.createTag")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("transactions.tagsLimit", { count: value.length, max: maxTags })}
      </p>
    </div>
  );
}
