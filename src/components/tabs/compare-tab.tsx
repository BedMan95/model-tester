"use client";

import { useState } from "react";
import { useApp } from "@/components/app-store";
import { Button, Card } from "@/components/ui";
import type { Metrics } from "@/lib/types";

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

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Model A</label>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card px-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {models.length === 0 && <option value="">Load models in Tester first</option>}
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Model B</label>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card px-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {models.length === 0 && <option value="">Load models in Tester first</option>}
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Prompt</label>
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write the prompt to compare responses on…"
            className="w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <Button variant="primary" className="mt-3" onClick={doRun} disabled={running || !modelA || !modelB}>
          {running ? "Running…" : "Run comparison"}
        </Button>
      </Card>

      {(sideA || sideB) && (
        <div className="grid gap-4 md:grid-cols-2">
          <ComparePanel title={modelA} data={sideA} />
          <ComparePanel title={modelB} data={sideB} />
        </div>
      )}
    </div>
  );
}

function ComparePanel({ title, data }: { title: string; data: Side | null }) {
  const m = data?.metrics;
  return (
    <Card>
      <div className="mb-2 border-b border-border pb-2 font-mono text-xs font-semibold text-foreground">
        {title}
      </div>
      {m && (
        <div className="mb-2 flex gap-3 font-mono text-[10px] text-muted-foreground">
          <span>TTFT {m.ttft}ms</span>
          <span>Lat {m.latency}ms</span>
          <span>{m.tps} t/s</span>
        </div>
      )}
      <pre className="min-h-24 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-xs text-foreground">
        {data?.error ?? data?.reply ?? "Waiting…"}
      </pre>
    </Card>
  );
}
