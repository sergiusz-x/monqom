export interface ApiErrorStructure {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export function formatApiError(error: ApiErrorStructure | unknown): string {
  const err = error as ApiErrorStructure | undefined;
  if (!err || typeof err !== "object") {
    return typeof error === "string" ? error : "An unknown error occurred";
  }

  if (err.response?.data?.message) {
    return err.response.data.message;
  }

  const status = err.response?.status;

  if (status === 401) {
    return "Unauthorized";
  }

  if (status === 403) {
    return "Forbidden";
  }

  if (status === 404) {
    return "Not found";
  }

  if (status !== undefined && status >= 500) {
    return "Server error";
  }

  return err.message ?? "An unknown error occurred";
}
