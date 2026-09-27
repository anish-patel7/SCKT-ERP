import { useCallback, useState } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 236;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;

// UI preference only (allowed in localStorage); never business data.
const STORAGE_KEY = "sckt_sidebar_width";

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));
}

function readStoredWidth(): number {
  try {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return stored ? clampSidebarWidth(Number(stored)) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

/** Expanded sidebar width in px, remembered per browser. */
export function useSidebarWidth(): [number, (width: number) => void] {
  const [width, setWidthState] = useState(readStoredWidth);
  const setWidth = useCallback((next: number) => {
    const clamped = clampSidebarWidth(next);
    setWidthState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Storage unavailable (private mode): the width still applies for this session.
    }
  }, []);
  return [width, setWidth];
}
