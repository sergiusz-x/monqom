interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Formats an API error (e.g., from axios or fetch) into a user-friendly string.
 *
 * Resolution order:
 * 1. `error.response.data.message` — server-provided message
 * 2. HTTP status 401 → 'Unauthorized'
 * 3. HTTP status 403 → 'Forbidden'
 * 4. HTTP status 404 → 'Not found'
 * 5. HTTP status >= 500 → 'Server error'
 * 6. `error.message` — JS Error message
 * 7. Fallback: 'An unknown error occurred'
 */
export function formatApiError(error: ApiErrorResponse): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  const status = error.response?.status;

  if (status === 401) {
    return 'Unauthorized';
  }

  if (status === 403) {
    return 'Forbidden';
  }

  if (status === 404) {
    return 'Not found';
  }

  if (status !== undefined && status >= 500) {
    return 'Server error';
  }

  return error.message ?? 'An unknown error occurred';
}
