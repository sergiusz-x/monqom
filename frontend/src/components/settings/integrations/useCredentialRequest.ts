import { useEffect, useRef } from "react";

/** Cancels the transport and ignores late results after dismissal or workspace change. */
export function useCredentialRequest() {
  const current = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      current.current?.abort();
      current.current = null;
    },
    [],
  );
  return {
    begin() {
      if (current.current) return null;
      const request = new AbortController();
      current.current = request;
      return request;
    },
    isCurrent(request: AbortController) {
      return current.current === request && !request.signal.aborted;
    },
    finish(request: AbortController) {
      if (current.current === request) current.current = null;
    },
  };
}
