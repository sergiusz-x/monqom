import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";

interface SalaryPrivacyContextValue {
  isRevealed: (transactionId: string) => boolean;
  reveal: (transactionId: string) => void;
}

const fallbackSalaryPrivacy: SalaryPrivacyContextValue = {
  isRevealed: () => false,
  reveal: () => undefined,
};

const SalaryPrivacyContext = createContext<SalaryPrivacyContextValue>(
  fallbackSalaryPrivacy,
);

function SalaryPrivacyState({ children }: { children: ReactNode }) {
  const [revealedTransactionIds, setRevealedTransactionIds] = useState<
    Set<string>
  >(() => new Set());
  const value = useMemo<SalaryPrivacyContextValue>(
    () => ({
      isRevealed: (transactionId) => revealedTransactionIds.has(transactionId),
      reveal: (transactionId) => {
        setRevealedTransactionIds((current) =>
          new Set(current).add(transactionId),
        );
      },
    }),
    [revealedTransactionIds],
  );

  return (
    <SalaryPrivacyContext.Provider value={value}>
      {children}
    </SalaryPrivacyContext.Provider>
  );
}

export function SalaryPrivacyProvider({ children }: { children: ReactNode }) {
  const user = useOptionalAuth()?.user;
  const stateKey = `${user?.id ?? "anonymous"}:${user?.hideSalaryAmounts ? user.updatedAt : "disabled"}`;

  return <SalaryPrivacyState key={stateKey}>{children}</SalaryPrivacyState>;
}

export function useSalaryPrivacy(): SalaryPrivacyContextValue {
  return useContext(SalaryPrivacyContext);
}
