"use client";

import { useApp, StatusBadge } from "@/components/app-store";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { TestRecord } from "@/lib/types";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Clock, ArrowCounterClockwise, Trash, ArrowRight, CalendarBlank } from "@phosphor-icons/react";

export default function HistoryTab() {
  const { history, clearHistory, creds, setCreds, models } = useApp();
  const reduceMotion = useReducedMotion();

  const recall = (r: TestRecord) => {
    setCreds({ ...creds, url: r.url });
  };

  const copyModel = (model: string) => {
    navigator.clipboard.writeText(model);
  };

  const getStatusTone = (status: TestRecord["status"]) => {
    switch (status) {
      case "ok": return "ok";
      case "limit": return "limit";
      case "fail": return "fail";
      default: return "neutral";
    }
  };

  const statusColors = {
    ok: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5",
    limit: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5",
    fail: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5",
    neutral: "border-border text-muted-foreground bg-muted/50",
  };

  const statusLabels = {
    ok: "Work",
    limit: "Limit",
    fail: "Fail",
    untested: "Untested",
    testing: "Testing",
  };

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <section aria-labelledby="history-empty" className="space-y-4">
          <h2 id="history-empty" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </h2>

          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="relative">
              <CalendarBlank className="h-16 w-16 text-muted-foreground/30" weight="thin" />
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-border bg-background" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No test history yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Run model tests in the Tester tab to build your history. Each test records the model, endpoint, latency, and status.
            </p>
            <Button variant="primary" size="sm" onClick={() => window.location.href = "/"} className="mt-4 gap-2">
              <ArrowRight className="h-4 w-4" weight="regular" />
              Go to Tester
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const reversedHistory = [...history].reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="history-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Test History
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-mono text-muted-foreground">
            {history.length} {history.length === 1 ? "record" : "records"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(["all", "ok", "limit", "fail"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                f === "all"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f === "ok" ? "Work" : f === "limit" ? "Limit" : "Fail"}
            </button>
          ))}
        </div>
      </section>

      {/* History list */}
      <section aria-labelledby="history-list" className="space-y-3">
        <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
          <div className="divide-y divide-border">
            <AnimatePresence mode="wait">
              {reversedHistory.map((h, i) => {
                const m = h.metrics;
                const tone = getStatusTone(h.status);
                const colors = statusColors[tone];
                const isWork = h.status === "ok";

                return (
                  <motion.div
                    key={`${h.model}-${h.timestamp}-${i}`}
                    initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                    animate={reduceMotion ? false : { opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, transition: reduceMotion ? { duration: 0.01 } : { duration: 0.2, ease: "easeOut" } }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="group"
                  >
                    <div className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-mono text-sm font-semibold text-foreground max-w-[60%]">
                              {h.model}
                            </span>
                            
                            {isWork && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyModel(h.model); }}
                                className="px-2 py-1 text-[10px] font-mono text-brand hover:bg-brand/10 rounded transition-colors"
                                title="Copy model ID"
                                aria-label={`Copy ${h.model}`}
                              >
                                Copy
                              </button>
                            )}

                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              colors,
                            )}>
                              {statusLabels[h.status] || h.status}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="truncate font-mono max-w-[70%]">{h.url}</span>
                            <span className="whitespace-nowrap">
                              {h.timestamp ? new Date(h.timestamp).toLocaleString() : "Unknown time"}
                            </span>
                            {h.preset && h.preset !== "openai-compatible" && (
                              <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground">
                                {h.preset}
                              </span>
                            )}
                          </div>

                          {m && (
                            <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
                              <span>TTFT <b className="tabular-nums text-foreground">{m.ttft}</b>ms</span>
                              <span>Lat <b className="tabular-nums text-foreground">{m.latency}</b>ms</span>
                              <span><b className="tabular-nums text-foreground">{m.tps}</b> t/s</span>
                              <span><b className="tabular-nums text-foreground">{m.tokens}</b> tok</span>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => recall(h)}
                            className="gap-1.5 text-xs"
                          >
                            <ArrowCounterClockwise className="h-3.5 w-3.5" weight="regular" />
                            <span>Recall</span>
                          </Button>

                          <span className="text-[10px] text-muted-foreground/60">
                            #{history.length - i}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Clear action */}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={clearHistory} className="gap-1.5">
            <Trash className="h-3.5 w-3.5" weight="regular" />
            Clear all history
          </Button>
        </div>
      </section>
    </div>
  );
}