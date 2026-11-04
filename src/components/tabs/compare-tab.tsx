"use client";

import { useState } from "react";
import { useApp } from "@/components/app-store";
import { Button, ModelSelect } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Metrics } from "@/lib/types";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, XCircle, Clock, Copy } from "@phosphor-icons/react";

interface Side {
  model: string;
  reply: string;
  metrics?: Metrics;
  error?: string;
}

export default function CompareTab() {
  const { models, creds } = useApp();
  const [modelA, setModelA] = useState(models[0] ?? "");
  const [modelB, setModelB] = useState(models[1] ?? models[0] ?? "");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [sideA, setSideA] = useState<Side | null>(null);
  const [sideB, setSideB] = useState<Side | null>(null);

  const run = async (model: string, setSide: (s: Side) => void) => {
    setSide({ model, reply: "…" });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: creds.url || "",
          key: creds.key,
          preset: creds.preset,
          model,
          userPrompt: prompt || "Hello, summarize AI in one sentence.",
        }),
      });
      const d = await res.json();
      setSide({ model, reply: d.reply ?? "", error: d.error, metrics: d.metrics });
    } catch (e) {
      setSide({ model, reply: "", error: (e as Error).message });
    }
  };

  const doRun = async () => {
    if (!modelA || !modelB) return;
    setRunning(true);
    setSideA(null);
    setSideB(null);
    await Promise.all([
      run(modelA, setSideA),
      run(modelB, setSideB),
    ]);
    setRunning(false);
  };

  const clearResults = () => {
    setSideA(null);
    setSideB(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuration — no card, clean sections */}
      <section aria-labelledby="compare-config" className="space-y-4">
        <h2 id="compare-config" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Configuration
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <ModelPicker
            label="Model A"
            value={modelA}
            onChange={setModelA}
            models={models}
            accent="left"
          />
          <ModelPicker
            label="Model B"
            value={modelB}
            onChange={setModelB}
            models={models}
            accent="right"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="compare-prompt" className="text-xs font-medium text-muted-foreground">
            Prompt
          </label>
          <textarea
            id="compare-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write the prompt to compare responses on…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button
            variant="primary"
            size="md"
            onClick={doRun}
            disabled={running || !modelA || !modelB}
            className="gap-2"
          >
            {running ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
                Running…
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" weight="regular" />
                Run comparison
              </>
            )}
          </Button>

          {(sideA || sideB) && (
            <Button variant="ghost" size="sm" onClick={clearResults}>
              Clear results
            </Button>
          )}

          {!models.length && (
            <span className="text-xs text-muted-foreground ml-auto">
              Load models in Tester first
            </span>
          )}
        </div>
      </section>

      {/* Results — side by side with clear distinction */}
      {(sideA || sideB) && (
        <section aria-labelledby="compare-results" className="space-y-4">
          <h2 id="compare-results" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Results
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <ComparePanel
              model={modelA}
              data={sideA}
              position="left"
            />
            <ComparePanel
              model={modelB}
              data={sideB}
              position="right"
            />
          </div>
        </section>
      )}
    </div>
  );
}

function ModelPicker({
  label,
  value,
  onChange,
  models,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  models: string[];
  accent: "left" | "right";
}) {
  const accentClasses = {
    left: "focus-within:ring-brand/30",
    right: "focus-within:ring-brand/30",
  }[accent];

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-brand/60" />
        {label}
      </label>
      <div className={cn("relative", accentClasses)}>
        <ModelSelect
          value={value}
          onChange={onChange}
          models={models}
          placeholder={models.length ? "Select a model…" : "Load models in Tester first"}
          className="w-full h-9 pr-8"
        />
      </div>
    </div>
  );
}

function ComparePanel({
  model,
  data,
  position,
}: {
  model: string;
  data: Side | null;
  position: "left" | "right";
}) {
  const m = data?.metrics;
  const isLeft = position === "left";
  const reduceMotion = useReducedMotion();

  const accentConfig = {
    border: "border-brand/30",
    bg: "bg-brand/5",
    text: "text-brand dark:text-brand",
    ring: "ring-brand/30",
    badge: "bg-brand/10 text-brand dark:text-brand-foreground",
    dot: "bg-brand/60",
    headerText: "text-brand",
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: isLeft ? 0 : 0.1 }}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border",
        accentConfig.border,
        accentConfig.bg,
        accentConfig.ring,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: "var(--color-brand)" }} />
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {model}
          </span>
        </div>

        {m && (
          <div className={cn("flex items-center gap-3 font-mono text-[10px] shrink-0", accentConfig.headerText)}>
            <span>TTFT <b className="tabular-nums">{m.ttft}</b>ms</span>
            <span>Lat <b className="tabular-nums">{m.latency}</b>ms</span>
            <span><b className="tabular-nums">{m.tps}</b> t/s</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[200px] max-h-[500px]">
        {data?.error ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-rose-600 dark:text-rose-400 text-sm font-mono">
            <XCircle className="h-4 w-4 shrink-0" weight="regular" />
            <span className="whitespace-pre-wrap">{data.error}</span>
          </div>
        ) : data?.reply ? (
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">
            {data.reply}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
            Waiting…
          </div>
        )}
      </div>

      {/* Metrics footer */}
      {m && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/30">
          <div className={cn("flex items-center gap-1.5 text-[10px] font-medium", accentConfig.headerText)}>
            <Clock className="h-3 w-3" weight="regular" />
            <span>Tokens: <b className="tabular-nums">{m.tokens}</b></span>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(data?.reply || "")}
            disabled={!data?.reply}
            className={cn(
              "px-2 py-1 text-[10px] font-mono rounded transition-colors",
              accentConfig.badge,
              "hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            title="Copy response"
          >
            <Copy className="h-3 w-3 mr-1" weight="regular" />
            Copy
          </button>
        </div>
      )}
    </motion.div>
  );
}