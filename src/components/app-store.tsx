"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type {
  ChatMessage,
  CompatResult,
  ModelTestStatus,
  ProviderFamily,
  TestRecord,
} from "@/lib/types";
import { PRESETS } from "@/lib/types";
import { cn } from "@/lib/cn";

export interface Credentials {
  preset: ProviderFamily;
  url: string;
  key: string;
}

export interface ModelRow {
  model: string;
  status: ModelTestStatus;
  metrics?: { ttft: number; latency: number; tokens: number; tps: number };
  compat?: CompatResult;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
}

/** All cross-tab state lives in the context so it survives page transitions. */
interface AppContextValue {
  creds: Credentials;
  setCreds: (c: Credentials) => void;
  setPreset: (p: ProviderFamily) => void;
  activeUrl: string;

  models: string[];
  setModels: (m: string[]) => void;
  rows: Record<string, ModelRow>;
  setRow: (m: string, r: Partial<ModelRow>) => void;
  resetRows: () => void;

  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: (model: string) => void;
  deleteSession: (id: string) => void;
  getSession: (id: string | null) => ChatSession | undefined;
  updateSession: (s: ChatSession) => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;

  history: TestRecord[];
  pushHistory: (r: TestRecord) => void;
  clearHistory: () => void;
}

/**
 * Old localStorage may hold v1 preset values ("custom", "groq", …).
 * The only family that survives a reload untouched is a known one.
 */
function sanitizePreset(p: unknown): ProviderFamily {
  return p === "anthropic" || p === "gemini" ? p : "openai-compatible";
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [creds, setCredsState] = useLocalStorage<Credentials>(
    "model_tester_credentials",
    { preset: "openai-compatible", url: "", key: "" },
  );

  // Normalize preset once on mount (cheap; runs before any user action).
  useEffect(() => {
    if (creds.preset !== sanitizePreset(creds.preset)) {
      setCredsState((prev) => ({ ...prev, preset: "openai-compatible" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [models, setModels] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, ModelRow>>({});

  const [sessions, setSessions] = useLocalStorage<ChatSession[]>(
    "model_tester_sessions",
    [],
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [history, setHistory] = useLocalStorage<TestRecord[]>(
    "model_tester_history",
    [],
  );

  const setRow = useCallback(
    (m: string, r: Partial<ModelRow>) =>
      setRows((prev) => ({ ...prev, [m]: { ...prev[m], model: m, status: prev[m]?.status ?? "untested", ...r } as ModelRow })),
    [],
  );

  const value = useMemo<AppContextValue>(() => {
    const activeUrl = creds.url.trim() || (PRESETS[creds.preset] ?? "");

    return {
      creds,
      setCreds: setCredsState,
      setPreset: (p) =>
        setCredsState((prev) => ({ ...prev, preset: p, url: PRESETS[p] || prev.url })),
      activeUrl,

      models,
      setModels,
      rows,
      setRow,
      resetRows: () => setRows({}),

      sessions,
      activeSessionId,
      setActiveSessionId,
      createSession: (model) => {
        const id = `s_${Date.now().toString(36)}`;
        const s: ChatSession = {
          id,
          title: model || "Chat",
          model,
          messages: [],
          createdAt: Date.now(),
        };
        setSessions((prev) => [s, ...prev]);
        setActiveSessionId(id);
      },
      deleteSession: (id) => {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) setActiveSessionId(null);
      },
      getSession: (id) => sessions.find((s) => s.id === id),
      updateSession: (s) =>
        setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x))),
      appendMessage: (sessionId, msg) =>
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, msg] }
              : s,
          ),
        ),

      history,
      pushHistory: (r) => setHistory((prev) => [r, ...prev].slice(0, 100)),
      clearHistory: () => setHistory([]),
    };
  }, [
    creds,
    setCredsState,
    models,
    rows,
    setRow,
    sessions,
    setSessions,
    activeSessionId,
    history,
    setHistory,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** Shared presentational atoms so the four tabs stay visually consistent. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: ModelTestStatus;
  label?: string;
  className?: string;
}) {
  const map: Record<ModelTestStatus, { cls: string; text: string }> = {
    ok: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", text: "Work" },
    limit: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400", text: "Limit" },
    fail: { cls: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400", text: "Fail" },
    testing: { cls: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 animate-pulse", text: "Testing…" },
    untested: { cls: "border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-500 dark:text-zinc-400", text: "Untested" },
  };
  const m = map[status] ?? map.untested;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        m.cls,
        className,
      )}
    >
      {label ?? m.text}
    </span>
  );
}

export function CompatChips({ result }: { result: CompatResult }) {
  const items: [keyof CompatResult, string][] = [
    ["chat", "Chat"],
    ["tools", "Tools"],
    ["json", "JSON"],
    ["stream", "Stream"],
    ["vision", "Vision"],
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([k, label]) => {
        const s = result[k] ?? "untested";
        const cls =
          s === "ok"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : s === "limit"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : s === "untested"
                ? "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
        return (
          <span
            key={k}
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
              cls,
            )}
          >
            {label}
            <span className="ml-1 opacity-60">{(result[k] ?? "—").toUpperCase()}</span>
          </span>
        );
      })}
    </div>
  );
}

export function latencyColor(ms: number, cap = 3000): string {
  const pct = Math.min(1, ms / cap);
  if (pct < 0.4) return "bg-emerald-500";
  if (pct < 0.75) return "bg-amber-500";
  return "bg-rose-500";
}
