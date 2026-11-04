"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-store";
import { Button, ModelSelect } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/types";
import { motion, useReducedMotion } from "motion/react";
import { Plus, User, Robot, ArrowRight, Trash } from "@phosphor-icons/react";

export default function ChatTab() {
  const app = useApp();
  const { sessions, activeSessionId, setActiveSessionId, createSession, deleteSession, getSession, updateSession, appendMessage, titleMessage, models, creds } = app;

  const active = getSession(activeSessionId) ?? sessions[0];

  useEffect(() => {
    if (sessions.length && !activeSessionId) setActiveSessionId(sessions[0].id);
  }, [sessions, activeSessionId, setActiveSessionId]);

  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modelForSend = active?.model || models[0] || "";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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
    setThinking(true);
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
            if (thinking) setThinking(false);
            full += ev.chunk;
            setStreamText(full);
          }
          if (ev.done) {
            full = ev.error ? `Error: ${ev.error}` : full || "No response";
            break;
          }
        }
      }
      appendMessage(sessionId, { role: "assistant", content: full, model: base.model || modelForSend });
    } catch (e) {
      appendMessage(sessionId, { role: "assistant", content: `Network error: ${(e as Error).message}`, model: base.model || modelForSend });
    } finally {
      setStreamText("");
      setThinking(false);
      setBusy(false);
    }
  };

  const handleNewSession = () => createSession(modelForSend);

  return (
    <div className="flex h-full min-h-0 gap-4 w-full pb-8 md:pb-0">
      {/* Sessions sidebar */}
      <aside className="hidden h-full w-56 shrink-0 flex-col gap-3 md:flex" aria-label="Chat sessions">
        <Button variant="primary" size="sm" onClick={handleNewSession} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" weight="regular" />
          New session
        </Button>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No sessions yet
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={cn(
                  "relative w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-150 group",
                  s.id === activeSessionId
                    ? "bg-brand/10 text-brand"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="truncate block">{s.title || "Untitled"}</span>
                {s.model && (
                  <span className="mt-0.5 text-[10px] font-mono text-muted-foreground group-hover:text-foreground/60 transition-colors block truncate">
                    {s.model}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat window */}
      <section className="flex h-full min-h-0 flex-1 flex-col" aria-label="Conversation">
        {/* Header bar */}
        <header className="border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0 z-[60]">
          {/* Mobile session row */}
          <div className="flex md:hidden items-center justify-between gap-2 mb-3 pb-3 border-b border-border/50">
            <select
              value={activeSessionId ?? ""}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm font-mono text-foreground focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-colors"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title || "Untitled"}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={handleNewSession} className="h-9 px-2">
              <Plus className="h-4 w-4" weight="regular" />
            </Button>
          </div>

          {/* Desktop/Content Header */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-sm font-semibold text-foreground truncate flex-shrink-0">
              {active?.title ?? "No session"}
            </h1>

            <div className="flex-1 flex justify-center">
              {active && models.length > 0 && (
                <ModelSelect
                  value={modelForSend}
                  onChange={(m) => {
                    if (active) updateSession({ ...active, model: m });
                    else createSession(m);
                  }}
                  models={models}
                  placeholder="Select a model…"
                  className="w-48"
                />
              )}
            </div>

            {active && (
              <Button variant="ghost" size="sm" onClick={() => deleteSession(active.id)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 flex-shrink-0">
                <Trash className="h-4 w-4" weight="regular" />
              </Button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4" role="log" aria-live="polite" aria-label="Messages">
          {(!active || active.messages.length === 0) && !streamText && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Robot className="h-12 w-12 text-muted-foreground/30" weight="thin" />
              <p className="mt-4 text-sm font-medium text-foreground">Start a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">Select a model and send your first message</p>
            </div>
          )}

          {active?.messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}

          {streamText && (
            <MessageBubble
              msg={{ role: "assistant", content: streamText }}
              streaming
              model={active?.model}
              thinking={thinking}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything…"
              disabled={busy}
              className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
              aria-label="Message input"
            />
            <Button
              type="submit"
              variant="primary"
              onClick={send}
              disabled={busy || !input.trim()}
              className="h-10 px-4"
              aria-label="Send message"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <ArrowRight className="h-4 w-4" weight="regular" />
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MessageBubble({
  msg,
  streaming,
  model,
  thinking,
}: { msg: ChatMessage; streaming?: boolean; model?: string; thinking?: boolean }) {
  const isUser = msg.role === "user";
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <div className="relative shrink-0 w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Robot className="h-4 w-4 text-brand" weight="regular" />
        </div>
      )}

      <div className={cn("flex-1 min-w-0", isUser ? "text-right" : "text-left")}>
        <div className="flex items-center gap-2 mb-1">
          {!isUser && model && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-mono text-brand">
              {model}
            </span>
          )}
          <span className="text-[11px] font-medium text-muted-foreground">
            {isUser ? "You" : "Assistant"}
          </span>
          {!isUser && (thinking || streaming) && (
            <ThinkingIndicator />
          )}
        </div>

        <div
          className={cn(
            "inline-block max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm font-mono leading-relaxed",
            isUser
              ? "bg-brand text-brand-foreground rounded-tr-sm"
              : "bg-muted/50 text-foreground rounded-tl-sm border border-border",
          )}
        >
          {msg.content}
          {streaming && <span className="ml-1 animate-pulse text-brand">▋</span>}
        </div>
      </div>

      {isUser && (
        <div className="relative shrink-0 w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <User className="h-4 w-4 text-muted-foreground" weight="regular" />
        </div>
      )}
    </motion.div>
  );
}

function ThinkingIndicator() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" aria-label="Thinking">
        <span className="flex gap-0.5" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
        </span>
        <span className="hidden sm:inline">Thinking…</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" aria-label="Thinking">
      <span className="flex gap-0.5" aria-hidden="true">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15, ease: "easeInOut" }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3, ease: "easeInOut" }}
        />
      </span>
      <span className="hidden sm:inline">Thinking…</span>
    </span>
  );
}
