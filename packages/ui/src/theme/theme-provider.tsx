import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  /** What the user chose. */
  theme: ThemePreference;
  /** What is actually applied after resolving "system". */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void) {
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

const getServerSystemTheme = (): ResolvedTheme => "light";

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

function readStoredTheme(key: string): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(key);
    return isThemePreference(value) ? value : null;
  } catch {
    // Storage can be unavailable (privacy mode, sandboxed iframes).
    return null;
  }
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** Used when nothing is stored yet. */
  defaultTheme?: ThemePreference;
  /** localStorage key used to persist the preference. Pass `null` to disable persistence. */
  storageKey?: string | null;
  /** Element that receives `data-theme`. Defaults to `<html>`. */
  target?: HTMLElement | null;
}

/**
 * Applies the light or dark theme by setting `data-theme` on the target element,
 * following the OS preference when the user picks "system".
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "cf-theme",
  target,
}: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemePreference>(
    () => (storageKey ? readStoredTheme(storageKey) : null) ?? defaultTheme,
  );
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    getServerSystemTheme,
  );
  const theme = preference;
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    (target ?? document.documentElement).setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme, target]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setPreference(next);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Persisting is best-effort; the in-memory preference still applies.
      }
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** Read and change the active theme. Must be used inside a `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return context;
}
