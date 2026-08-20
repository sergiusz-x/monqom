import api from "@/lib/api";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import {
  AuthApi,
  BudgetsApi,
  CategoriesApi,
  DashboardApi,
  ExportApi,
  GoalsApi,
  PaymentSourcesApi,
  TransactionTagsApi,
  TransactionsApi,
  UsersApi,
  WorkspaceApi,
  WorkspaceScopedApi,
} from "@/api/client";

// The shared axios instance already owns /api/v1 and all CSRF/session
// interceptors. This adapter keeps generated routes as the source of truth
// without bypassing that transport policy.
const generatedTransport = {
  request<T = unknown>(config: AxiosRequestConfig) {
    const method = config.method?.toLowerCase() ?? "get";
    const url = config.url ?? "";
    const options: AxiosRequestConfig = {};
    if (config.params !== undefined) options.params = config.params;
    if (config.signal !== undefined) options.signal = config.signal;
    if (config.responseType !== undefined)
      options.responseType = config.responseType;
    const hasOptions = Object.keys(options).length > 0;
    const data =
      typeof config.data === "string" && config.data.length > 0
        ? (JSON.parse(config.data) as unknown)
        : config.data;

    switch (method) {
      case "get":
        return hasOptions ? api.get<T>(url, options) : api.get<T>(url);
      case "delete":
        return hasOptions ? api.delete<T>(url, options) : api.delete<T>(url);
      case "post":
        if (hasOptions) return api.post<T>(url, data, options);
        return data === undefined ? api.post<T>(url) : api.post<T>(url, data);
      case "put":
        return hasOptions
          ? api.put<T>(url, data, options)
          : api.put<T>(url, data);
      case "patch":
        return hasOptions
          ? api.patch<T>(url, data, options)
          : api.patch<T>(url, data);
      default:
        return api.request<T>(config);
    }
  },
} as AxiosInstance;

export const authApi = new AuthApi(undefined, "", generatedTransport);
export const budgetsApi = new BudgetsApi(undefined, "", generatedTransport);
export const categoriesApi = new CategoriesApi(
  undefined,
  "",
  generatedTransport,
);
export const dashboardApi = new DashboardApi(undefined, "", generatedTransport);
export const exportApi = new ExportApi(undefined, "", generatedTransport);
export const goalsApi = new GoalsApi(undefined, "", generatedTransport);
export const paymentSourcesApi = new PaymentSourcesApi(
  undefined,
  "",
  generatedTransport,
);
export const transactionTagsApi = new TransactionTagsApi(
  undefined,
  "",
  generatedTransport,
);
export const transactionsApi = new TransactionsApi(
  undefined,
  "",
  generatedTransport,
);
export const usersApi = new UsersApi(undefined, "", generatedTransport);
export const workspaceApi = new WorkspaceApi(undefined, "", generatedTransport);
export const workspaceScopedApi = new WorkspaceScopedApi(
  undefined,
  "",
  generatedTransport,
);
