import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "monqom-theme";
const LEGACY_STORAGE_KEY = "monqom-dark-mode";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function readInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isThemeMode(stored)) return stored;

  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyValue === "true") return "dark";
  if (legacyValue === "false") return "light";
  return "system";
}

function systemUsesDarkTheme(): boolean {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialTheme);
  const [systemIsDark, setSystemIsDark] = useState(systemUsesDarkTheme);
  const isDark = mode === "dark" || (mode === "system" && systemIsDark);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(DARK_MEDIA_QUERY);
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemIsDark(event.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setMode(isThemeMode(event.newValue) ? event.newValue : "system");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [isDark, mode]);

  const value = useMemo(() => ({ mode, isDark, setMode }), [mode, isDark]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
