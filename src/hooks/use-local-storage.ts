"use client";

import { useEffect, useState } from "react";

/**
 * Storage-backed state that is safe for server rendering.
 *
 * The first client render must match the server, so we start from `initial`
 * and adopt the stored value right after mount. Reading during the first
 * render instead would cause a hydration mismatch (React error #418) wherever
 * a stored value is rendered as text — session titles, model lists, params.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage blocked or corrupt entry — keep the default */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    // `loaded` is still false in this commit's closure, so the stored value
    // is never clobbered by `initial` during mount.
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be full or blocked */
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
