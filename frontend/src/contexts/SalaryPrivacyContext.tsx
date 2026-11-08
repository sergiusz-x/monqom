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

export function SalaryPrivacyProvider({ children }: { children: ReactNode }) {
  const user = useOptionalAuth()?.user;
  const stateKey = `${user?.id ?? "anonymous"}:${user?.hideSalaryAmounts ? user.updatedAt : "disabled"}`;
  const [revealed, setRevealed] = useState<{ key: string; ids: Set<string> }>(
    () => ({ key: stateKey, ids: new Set() }),
  );
  if (revealed.key !== stateKey) {
    setRevealed({ key: stateKey, ids: new Set() });
  }
  const value = useMemo<SalaryPrivacyContextValue>(
    () => ({
      isRevealed: (transactionId) =>
        revealed.key === stateKey && revealed.ids.has(transactionId),
      reveal: (transactionId) =>
        setRevealed((current) => ({
          key: stateKey,
          ids: new Set(current.key === stateKey ? current.ids : []).add(
            transactionId,
          ),
        })),
    }),
    [revealed, stateKey],
  );

  return (
    <SalaryPrivacyContext.Provider value={value}>
      {children}
    </SalaryPrivacyContext.Provider>
  );
}

export function useSalaryPrivacy(): SalaryPrivacyContextValue {
  return useContext(SalaryPrivacyContext);
}
