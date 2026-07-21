import axios, { AxiosError } from "axios";

const API_BASE_URL = "/api/v1";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_INVALID_CODE = "CSRF_TOKEN_INVALID";
const SAFE_METHODS = new Set(["get", "head", "options"]);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const csrfClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  csrfTokenRequest ??= csrfClient
    .get<{ csrfToken: string }>("/auth/csrf-token")
    .then((response) => {
      csrfToken = response.data.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfTokenRequest = null;
    });

  return csrfTokenRequest;
}

api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase() ?? "get";

  if (!SAFE_METHODS.has(method)) {
    config.headers.set(CSRF_HEADER_NAME, await getCsrfToken());
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.url === "/auth/logout") csrfToken = null;
    return response;
  },
  async (error: AxiosError<{ code?: string }>) => {
    const config = error.config as
      | (NonNullable<typeof error.config> & { csrfRetry?: boolean })
      | undefined;

    if (
      error.response?.status === 403 &&
      error.response.data?.code === CSRF_INVALID_CODE &&
      config &&
      !config.csrfRetry
    ) {
      csrfToken = null;
      config.csrfRetry = true;
      return api.request(config);
    }

    return Promise.reject(error);
  },
);

export default api;
