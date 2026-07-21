import { useEffect, useRef } from "react";

export function useFocusOnError(error: unknown) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!error) return;
    const invalidControl = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    invalidControl?.focus();
  }, [error]);

  return formRef;
}
