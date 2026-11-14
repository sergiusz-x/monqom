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
  revealAll: boolean;
  hideVersion: number;
  setRevealAll: (revealed: boolean) => void;
}

const fallbackSalaryPrivacy: SalaryPrivacyContextValue = {
  isRevealed: () => false,
  reveal: () => undefined,
  revealAll: false,
  hideVersion: 0,
  setRevealAll: () => undefined,
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
  const [revealAll, setRevealAllState] = useState(false);
  const [hideVersion, setHideVersion] = useState(0);
  if (revealed.key !== stateKey) {
    setRevealed({ key: stateKey, ids: new Set() });
    setRevealAllState(false);
  }
  const value = useMemo<SalaryPrivacyContextValue>(
    () => ({
      isRevealed: (transactionId) =>
        revealAll ||
        (revealed.key === stateKey && revealed.ids.has(transactionId)),
      reveal: (transactionId) =>
        setRevealed((current) => ({
          key: stateKey,
          ids: new Set(current.key === stateKey ? current.ids : []).add(
            transactionId,
          ),
        })),
      revealAll,
      hideVersion,
      setRevealAll: (value) => {
        setRevealAllState(value);
        if (!value) {
          setRevealed({ key: stateKey, ids: new Set() });
          setHideVersion((version) => version + 1);
        }
      },
    }),
    [revealed, revealAll, stateKey, hideVersion],
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
