"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useApp, StatusBadge, CompatChips } from "@/components/app-store";
import { Button } from "@/components/ui";
import { PRESET_LABELS, PRESETS } from "@/lib/types";
import type { ProviderFamily, ModelTestStatus, CompatResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { MagnifyingGlass, RocketLaunch, Copy, ArrowRight } from "@phosphor-icons/react";

const CONCURRENCY = 5;

function providerOfModel(m: string): string {
  if (m.includes("/")) return m.split("/")[0];
  return "other";
}

interface TestParams {
  sysPrompt: string;
  userPrompt: string;
  temp: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  autoRetry: boolean;
}

const defaultParams: TestParams = {
  sysPrompt: "You are a helpful assistant.",
  userPrompt: "Reply with exactly: OK",
  temp: 0.7,
  topP: 1,
  maxTokens: 2048,
  timeoutMs: 5000,
  autoRetry: false,
};

export default function TesterTab() {
  const app = useApp();
  const { creds, setCreds, models, setModels, rows, setRow, resetRows, pushHistory } = app;

  const [params, setParams] = useLocalStorage<TestParams>("model_tester_params", defaultParams);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "ok" | "limit" | "fail">("all");
  const [compatLoading, setCompatLoading] = useState<string | null>(null);

  const update = <K extends keyof TestParams>(k: K, v: TestParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const doLoad = useCallback(async () => {
    if (!creds.url && !PRESETS[creds.preset]) {
      setError("Enter a Base URL or pick a preset.");
      return;
    }
    setLoading(true);
    setError("");
    resetRows();
    setSelected(new Set());
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: creds.url || PRESETS[creds.preset] || "",
          key: creds.key,
          preset: creds.preset,
        }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        setModels([]);
      } else {
        setModels(d.models ?? []);
      }
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [creds, setCreds, setModels, resetRows]);

  const doTest = useCallback(async (targetModels: string[]) => {
    for (const m of targetModels) setRow(m, { status: "testing" });

    for (let i = 0; i < targetModels.length; i += CONCURRENCY) {
      await Promise.all(targetModels.slice(i, i + CONCURRENCY).map((m) => testOne(m)));
    }
  }, [creds, params, setRow]);

  const testOne = async (m: string, isRetry = false) => {
    const base: Record<string, unknown> = {
      url: creds.url || PRESETS[creds.preset] || "",
      key: creds.key,
      preset: creds.preset,
      model: m,
      sysPrompt: params.sysPrompt,
      userPrompt: params.userPrompt,
      temp: params.temp,
      topP: params.topP,
      maxTokens: params.maxTokens,
      timeoutMs: params.timeoutMs,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      });
      const d = await res.json();

      if (d.error && params.autoRetry && !isRetry && /limit|429/i.test(d.error)) {
        await new Promise((r) => setTimeout(r, 2000));
        return testOne(m, true);
      }

      let status: ModelTestStatus = "fail";
      if (!d.error && d.reply && /prevent abuse of free resources|limit exceeded|rate limit/i.test(d.reply))
        status = "limit";
      else if (!d.error) status = "ok";

      setRow(m, {
        status,
        metrics: d.metrics,
        error: d.error,
      });
      pushHistory({
        model: m,
        url: base.url as string,
        preset: creds.preset,
        status,
        metrics: d.metrics,
        timestamp: Date.now(),
      });
    } catch (e) {
      setRow(m, { status: "fail", error: (e as Error).message });
    }
  };

  const doCompat = async (m: string) => {
    setRow(m, { compat: undefined });
    setCompatLoading(m);
    try {
      const res = await fetch("/api/compat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: creds.url || PRESETS[creds.preset] || "",
          key: creds.key,
          preset: creds.preset,
          model: m,
        }),
      });
      const d = await res.json();
      if (d.result) setRow(m, { compat: d.result as CompatResult });
    } catch {
      /* ignore */
    } finally {
      setCompatLoading(null);
    }
  };

  const doExport = useCallback(
    (format: "json" | "csv") => {
      const records = Object.values(rows).filter(
        (r) => r.status !== "untested" && r.status !== "testing",
      );
      if (!records.length) return;

      let text: string;
      let mime: string;
      let ext: string;
      if (format === "json") {
        text = JSON.stringify(records, null, 2);
        mime = "application/json";
        ext = "json";
      } else {
        const header = ["model", "status", "ttft_ms", "latency_ms", "tps", "tokens"];
        const lines = records.map((r) =>
          [r.model, r.status, r.metrics?.ttft ?? "", r.metrics?.latency ?? "", r.metrics?.tps ?? "", r.metrics?.tokens ?? ""]
            .map((v) => `"${v}"`)
            .join(","),
        );
        text = [header.join(","), ...lines].join("\n");
        mime = "text/csv";
        ext = "csv";
      }

      const blob = new Blob([text], { type: mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `model_test_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [rows],
  );

  const filteredModels = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [models, search]);

  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const m of filteredModels) {
      const row = rows[m];
      if (filter !== "all" && row?.status !== filter) continue;
      const p = providerOfModel(m);
      (g[p] ??= []).push(m);
    }
    return g;
  }, [filteredModels, rows, filter]);

  const activeRows = useMemo(
    () => Object.values(rows).filter((r) => r.status !== "untested" && r.status !== "testing"),
    [rows],
  );

  const summary = useMemo(() => {
    const count = (s: ModelTestStatus) => activeRows.filter((r) => r.status === s).length;
    return {
      ok: count("ok"),
      limit: count("limit"),
      fail: count("fail"),
      tokens: activeRows.reduce((acc, r) => acc + (r.metrics?.tokens ?? 0), 0),
    };
  }, [activeRows]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-6">
      {/* Endpoint Configuration */}
        <details className="rounded-lg border border-border bg-muted/30 p-4" open>
          <summary className="cursor-pointer select-none text-xs font-semibold text-foreground">
            Endpoint Configuration
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.5fr]">
            <div className="space-y-2">
              <label htmlFor="preset-select" className="text-xs font-medium text-muted-foreground">
                Provider
              </label>
              <select
                id="preset-select"
                value={creds.preset}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    preset: e.target.value as ProviderFamily,
                    url: PRESETS[e.target.value as ProviderFamily] || creds.url,
                  })
                }
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {Object.entries(PRESET_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="base-url" className="text-xs font-medium text-muted-foreground">
                Base URL
              </label>
              <input
                id="base-url"
                value={creds.url}
                onChange={(e) => setCreds({ ...creds, url: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="h-9 w-full rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <label htmlFor="api-key" className="text-xs font-medium text-muted-foreground">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={creds.key}
              onChange={(e) => setCreds({ ...creds, key: e.target.value })}
              placeholder="sk-…"
              className="h-9 w-full rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </details>

        <details className="rounded-lg border border-border bg-muted/30 p-4">
          <summary className="cursor-pointer select-none text-xs font-semibold text-foreground">
            Advanced parameters
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label htmlFor="sys-prompt" className="text-xs text-muted-foreground">
                  System prompt
                </label>
                <textarea
                  id="sys-prompt"
                  rows={2}
                  value={params.sysPrompt}
                  onChange={(e) => update("sysPrompt", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="user-prompt" className="text-xs text-muted-foreground">
                  User prompt
                </label>
                <textarea
                  id="user-prompt"
                  rows={2}
                  value={params.userPrompt}
                  onChange={(e) => update("userPrompt", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["Temperature", "temp", 0.1],
                ["Top P", "topP", 0.1],
                ["Max Tokens", "maxTokens", 1],
              ] as const).map(([label, key, step]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    type="number"
                    step={step}
                    value={params[key]}
                    onChange={(e) =>
                      update(key, key === "maxTokens" ? parseInt(e.target.value, 10) || 0 : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
            <div className="col-span-full grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">
                  Timeout: <b className="font-mono">{params.timeoutMs / 1000}s</b>
                </label>
                <input
                  type="range"
                  min={2}
                  max={15}
                  step={1}
                  value={Math.round(params.timeoutMs / 1000)}
                  onChange={(e) => update("timeoutMs", parseInt(e.target.value, 10) * 1000)}
                  className="mt-1 w-full accent-brand"
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={params.autoRetry}
                  onChange={(e) => update("autoRetry", e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                Auto-retry on rate limit
              </label>
            </div>
          </div>
        </details>

        {error && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <Button variant="primary" onClick={doLoad} disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                Loading…
              </>
            ) : (
              "Load Models"
            )}
          </Button>
          <Button onClick={() => doTest(filteredModels)} disabled={!filteredModels.length}>
            Test All ({filteredModels.length})
          </Button>
          <Button onClick={() => doTest(Array.from(selected))} disabled={!selected.size}>
            Test Selected ({selected.size})
          </Button>
          <span className="flex-1" />
          <Button size="sm" onClick={() => doExport("json")}>
            JSON
          </Button>
          <Button size="sm" onClick={() => doExport("csv")}>
            CSV
          </Button>
        </div>

      {/* Models List */}
      <section aria-labelledby="models-heading" className="flex-1 min-h-0 flex flex-col space-y-4">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 id="models-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Models ({models.length})
          </h2>
          {models.length > 0 && (
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter models…"
                className="h-8 w-56 rounded-lg border border-border bg-card px-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" weight="regular" />
            </div>
          )}
        </div>

        {activeRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0" role="group" aria-label="Filter by status">
            {[
              { key: "all", label: "All", count: activeRows.length, tone: "neutral" as const },
              { key: "ok", label: "Work", count: summary.ok, tone: "ok" as const },
              { key: "limit", label: "Limit", count: summary.limit, tone: "limit" as const },
              { key: "fail", label: "Fail", count: summary.fail, tone: "fail" as const },
            ].map(({ key, label, count, tone }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as "all" | "ok" | "limit" | "fail")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-brand text-brand-foreground border-brand"
                    : tone === "ok"
                    ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    : tone === "limit"
                    ? "text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    : tone === "fail"
                    ? "text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                    : "text-muted-foreground border-border hover:bg-muted",
                )}
                aria-pressed={filter === key}
              >
                {label}
                <span className={cn("font-mono tabular-nums", filter === key && "text-brand-foreground")}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 flex-1" role="status" aria-live="polite">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-xs text-muted-foreground">Loading models…</p>
          </div>
        ) : models.length === 0 ? (
          <div className="py-12 text-center flex-1" role="status">
            <RocketLaunch className="mx-auto h-10 w-10 text-muted-foreground/50" weight="thin" />
            <p className="mt-3 text-sm text-muted-foreground">No models loaded</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Choose a provider and click Load Models</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {Object.entries(grouped).map(([provider, list]) => (
              <div key={provider} className="space-y-1">
                <div className="flex items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-2 border-b border-border">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {provider} <span className="font-normal text-foreground/70">({list.length})</span>
                  </h3>
                  <Button size="sm" onClick={() => doTest(list)} className="gap-1">
                    Test {list.length}
                    <ArrowRight className="h-3 w-3" weight="regular" />
                  </Button>
                </div>

                <div className="divide-y divide-border bg-card/50 rounded-lg border border-border overflow-hidden">
                  {list.map((m) => {
                    const row = rows[m];
                    const isSel = selected.has(m);
                    return (
                      <div key={m} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {
                              const next = new Set(selected);
                              if (next.has(m)) next.delete(m);
                              else next.add(m);
                              setSelected(next);
                            }}
                            className="h-3.5 w-3.5 accent-brand shrink-0"
                            aria-label={`Select ${m}`}
                          />
                          <span className="truncate font-mono text-xs text-foreground">{m}</span>
                          {row?.metrics && (
                            <span className="hidden text-[10px] text-muted-foreground sm:inline" title={JSON.stringify(row.metrics)}>
                              {row.metrics.latency}ms · {row.metrics.tps}t/s
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {row?.compat ? (
                            <CompatChips result={row.compat} />
                          ) : (
                            <StatusBadge status={row?.status ?? "untested"} />
                          )}
                          {row?.status === "ok" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(m);
                              }}
                              className="p-1.5 text-brand hover:bg-brand/10 rounded transition-colors"
                              title="Copy model ID"
                              aria-label={`Copy ${m}`}
                            >
                              <Copy className="h-3 w-3" weight="regular" />
                            </button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2 py-1 text-[10px] gap-1"
                            onClick={() => doCompat(m)}
                            disabled={compatLoading === m}
                          >
                            {compatLoading === m ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                <span>Checking…</span>
                              </>
                            ) : (
                              "Compat"
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
