"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Reads localStorage on first render (lazy init) so the value is correct from
 * the very first paint — a fresh mount on /chat or /compare must already see
 * the credentials saved on the Tester page, not the default.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be full or blocked */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
