"use client";

import { useApp, StatusBadge } from "@/components/app-store";
import { Button, Card } from "@/components/ui";
import type { TestRecord } from "@/lib/types";

export default function HistoryTab() {
  const { history, clearHistory, creds, setCreds } = useApp();

  const recall = (r: TestRecord) => {
    // Restore URL so the Tester tab can re-run the same conditions; keep preset as-is
    // since a historical "custom" entry may no longer map to a preset.
    setCreds({ ...creds, url: r.url });
  };

  if (history.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-xs text-muted-foreground">
          No test history recorded yet.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Call &amp; test history
          <span className="ml-2 font-normal text-muted-foreground">({history.length})</span>
        </h3>
        <Button variant="danger" size="sm" onClick={clearHistory}>
          Clear
        </Button>
      </div>

      <div className="divide-y divide-border">
        {history.map((h, i) => {
          const m = h.metrics;
          return (
            <div key={`${h.model}-${i}`} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-semibold text-foreground">
                    {h.model}
                  </span>
                  <StatusBadge status={h.status} />
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {h.url} • {h.timestamp ? new Date(h.timestamp).toLocaleString() : ""}
                </div>
                {m && (
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    TTFT {m.ttft}ms · {m.latency}ms · {m.tps} t/s · {m.tokens} tok
                  </div>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => recall(h)}>
                Recall
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
