"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-store";
import { Button, Card, ModelSelect } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/types";

export default function ChatTab() {
  const app = useApp();
  const { sessions, activeSessionId, setActiveSessionId, createSession, deleteSession, getSession, updateSession, appendMessage, titleMessage, models, creds } = app;

  const active = getSession(activeSessionId) ?? sessions[0];

  useEffect(() => {
    if (sessions.length && !activeSessionId) setActiveSessionId(sessions[0].id);
  }, [sessions, activeSessionId, setActiveSessionId]);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const modelForSend = active?.model || models[0] || "";

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, streamText]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const sessionId = active ? active.id : createSession(modelForSend, text);
    const base = active ?? getSession(sessionId);
    if (!base) return;

    const messages = [...base.messages, userMsg];
    appendMessage(sessionId, userMsg);
    titleMessage(sessionId, text);

    setBusy(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: creds.url || "",
          key: creds.key,
          preset: creds.preset,
          model: base.model || modelForSend,
          messages,
          stream: true,
        }),
      });

      if (!res.body) {
        const d = await res.json().catch(() => null);
        appendMessage(sessionId, { role: "assistant", content: d?.reply || d?.error || "No response" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.chunk) {
            full += ev.chunk;
            setStreamText(full);
          }
          if (ev.done) {
            full = ev.error ? `Error: ${ev.error}` : full || "No response";
            break;
          }
        }
      }
      appendMessage(sessionId, { role: "assistant", content: full });
    } catch (e) {
      appendMessage(sessionId, { role: "assistant", content: `Network error: ${(e as Error).message}` });
    } finally {
      setStreamText("");
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      {/* Sessions */}
      <div className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
        <Button variant="primary" size="sm" onClick={() => createSession(modelForSend)}>
          + New session
        </Button>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-2">
          {sessions.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No sessions yet
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={cn(
                "truncate rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                s.id === activeSessionId
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">
              {active?.title ?? "No session"}
            </div>
            <div className="mt-0.5 max-w-full">
              {models.length > 0 ? (
                <ModelSelect
                  value={modelForSend}
                  onChange={(m) => {
                    if (active) updateSession({ ...active, model: m });
                    else createSession(m);
                  }}
                  models={models}
                  placeholder="Select a model…"
                  className="h-7 max-w-72 text-[10px]"
                />
              ) : (
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {modelForSend || "no model — load in Tester"}
                </span>
              )}
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => active && deleteSession(active.id)}>
            Delete
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {(!active || active.messages.length === 0) && !streamText && (
            <p className="py-10 text-center text-xs text-muted-foreground">
              No messages yet.
            </p>
          )}
          {active?.messages.map((m, i) => (
            <Bubble key={i} msg={m} model={m.role === "assistant" ? active.model : undefined} />
          ))}
          {streamText && <Bubble msg={{ role: "assistant", content: streamText }} streaming model={active?.model} />}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything…"
            disabled={busy}
            className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button variant="primary" onClick={send} disabled={busy || !input.trim()}>
            {busy ? "…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, streaming, model }: { msg: ChatMessage; streaming?: boolean; model?: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <span className="mb-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
        {msg.role}
        {!isUser && model && <span className="px-1.5 py-0.5 rounded bg-brand/10 text-brand text-[9px] font-mono">{model}</span>}
      </span>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs font-mono",
          isUser
            ? "bg-brand text-brand-foreground"
            : "border border-border bg-muted/50 text-foreground",
        )}
      >
        {msg.content}
        {streaming && <span className="animate-pulse">▋</span>}
      </div>
    </div>
  );
}
