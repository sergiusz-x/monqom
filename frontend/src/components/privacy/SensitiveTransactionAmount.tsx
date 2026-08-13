import { useTranslation } from "react-i18next";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useSalaryPrivacy } from "@/contexts/SalaryPrivacyContext";
import { isSalaryCategory } from "@/lib/category-system-keys";
import { formatCurrency } from "@/lib/money";
import type { Transaction } from "@/types/transaction";

interface SensitiveTransactionAmountProps {
  transaction: Transaction;
  categorySystemKeys: Record<string, string | null | undefined>;
  className?: string;
}

export function SensitiveTransactionAmount({
  transaction,
  categorySystemKeys,
  className,
}: SensitiveTransactionAmountProps) {
  const { t } = useTranslation();
  const user = useOptionalAuth()?.user;
  const { isRevealed, reveal } = useSalaryPrivacy();
  const shouldMask = Boolean(
    user?.hideSalaryAmounts &&
    isSalaryCategory(transaction.categoryId, categorySystemKeys),
  );
  const revealed = isRevealed(transaction.id);
  const amountTone =
    transaction.type === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  const amountClassName = [amountTone, className].filter(Boolean).join(" ");

  const displayAmount = (
    <>
      {transaction.type === "income" ? "+" : "-"}
      {formatCurrency(transaction.amount, transaction.currency)}
    </>
  );

  if (!shouldMask || revealed) {
    return (
      <span
        className={amountClassName}
        data-sensitive-amount={shouldMask ? "revealed" : "visible"}
      >
        {displayAmount}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={
        "inline-flex cursor-pointer select-none border-0 bg-transparent p-0 font-inherit blur-[8px] transition-[filter] duration-200 hover:blur-[5px] focus-visible:blur-[5px] " +
        amountClassName
      }
      data-sensitive-amount="masked"
      aria-label={t("privacy.revealSalaryAmount")}
      onClick={(event) => {
        event.stopPropagation();
        reveal(transaction.id);
      }}
    >
      {displayAmount}
    </button>
  );
}
