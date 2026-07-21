import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import api from "@/lib/api";
import i18n from "@/i18n";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  name: string;
  locale?: "en" | "pl";
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LoginResult =
  | { type: "authenticated"; user: User }
  | { type: "two_factor_required" };

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const sessionExpiredRef = useRef(false);
  const { showToast } = useToast(6000);
  const queryClient = useQueryClient();

  function updateUser(nextUser: User | null) {
    userRef.current = nextUser;
    if (nextUser) sessionExpiredRef.current = false;
    setUser(nextUser);
  }

  useEffect(() => {
    api
      .get<User>("/auth/me")
      .then((res) => updateUser(res.data))
      .catch(() => updateUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user?.locale) void i18n.changeLanguage(user.locale);
  }, [user?.locale]);

  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (error) => {
        if (
          error.response?.status === 401 &&
          userRef.current &&
          !sessionExpiredRef.current &&
          !isPublicAuthRequest(error.config?.url)
        ) {
          sessionExpiredRef.current = true;
          updateUser(null);
          queryClient.clear();
          showToast(i18n.t("apiErrors.authenticationRequired"), "error");
        }
        return Promise.reject(error);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, [queryClient, showToast]);

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post<
      User | { requiresTwoFactor: true; message: string }
    >("/auth/login", {
      email,
      password,
    });

    if ("requiresTwoFactor" in res.data && res.data.requiresTwoFactor) {
      return { type: "two_factor_required" };
    }

    const userData = res.data as User;
    updateUser(userData);
    return { type: "authenticated", user: userData };
  }

  async function logout(): Promise<void> {
    await api.post("/auth/logout");
    updateUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, setUser: updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function isPublicAuthRequest(url?: string): boolean {
  return [
    "/auth/me",
    "/auth/login",
    "/auth/2fa/verify",
    "/auth/register",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].some((path) => url?.includes(path));
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
