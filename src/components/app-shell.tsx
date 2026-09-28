"use client";

import type { ReactNode } from "react";
import { MobileNav } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppProvider } from "@/components/app-store";
import { useApp } from "@/components/app-store";
import type { ActiveKey } from "@/lib/nav";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export interface AppShellProps {
  active: ActiveKey;
  children: ReactNode;
}

const NAV: { key: ActiveKey; label: string; href: string }[] = [
  { key: "home", label: "Tester", href: "/" },
  { key: "chat", label: "Chat", href: "/chat" },
  { key: "compare", label: "Compare", href: "/compare" },
  { key: "history", label: "History", href: "/history" },
];

function HeaderContent({ active }: { active: ActiveKey }) {
  const { creds, models } = useApp();
  const presetLabels: Record<string, string> = {
    "openai-compatible": "OpenAI-compatible",
    anthropic: "Anthropic",
    gemini: "Gemini",
  };
  const providerLabel = presetLabels[creds.preset] || creds.preset;
  const hasModels = models.length > 0;
  const modelCount = models.length;

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ width: 0, transform: "translateX(0)" });
  const [mounted, setMounted] = useState(false);

  // Update pill position on active change or layout shift
  useEffect(() => {
    if (!mounted) return;
    const container = tabContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!activeTab) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const width = tabRect.width;
    const left = tabRect.left - containerRect.left;
    setPillStyle({ width, transform: `translateX(${left}px)` });
  }, [active, mounted]);

  useEffect(() => {
    setMounted(true);
    // Initial measure after paint
    requestAnimationFrame(() => {
      const container = tabContainerRef.current;
      if (!container) return;
      const activeTab = container.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!activeTab) return;
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setPillStyle({ width: tabRect.width, transform: `translateX(${tabRect.left - containerRect.left}px)` });
    });
    // Re-measure on resize
    const ro = new ResizeObserver(() => {
      const container = tabContainerRef.current;
      if (!container) return;
      const activeTab = container.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!activeTab) return;
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setPillStyle({ width: tabRect.width, transform: `translateX(${tabRect.left - containerRect.left}px)` });
    });
    ro.observe(tabContainerRef.current!);
    return () => ro.disconnect();
  }, [active]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Left: Brand + Provider context */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-violet-500 to-fuchsia-500 text-white shadow-sm shadow-indigo-500/20">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="font-semibold tracking-tight text-foreground">Model Tester</span>
            </Link>

            {/* Provider pill - only show when configured */}
            {(creds.url || creds.key) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-mono font-medium text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-75" />
                  <span className="relative rounded-full bg-indigo-500" />
                </span>
                {providerLabel}
                {hasModels && (
                  <span className="ml-1 rounded-full bg-border px-1.5 text-[10px] text-foreground/70">
                    {modelCount}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Center: Tabs with animated pill - integrated into header */}
          <nav className="flex-1 flex items-center justify-center" aria-label="Main navigation">
            <div className="relative flex h-10 items-center gap-0.5" ref={tabContainerRef} role="tablist">
              {/* Animated pill background */}
              {mounted && (
                <motion.div
                  className="absolute inset-y-1 rounded-full bg-brand/15 ring-1 ring-brand/30 pointer-events-none"
                  style={pillStyle as React.CSSProperties}
                  transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                  aria-hidden="true"
                />
              )}

              {NAV.map((item) => {
                const isActive = active === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    data-tab={item.key}
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      "relative z-10 px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "text-brand"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right: Theme toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * AppShell with integrated header + tabs.
 * State persists across tabs via AppProvider.
 */
export function AppShell({ active, children }: AppShellProps) {
  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <HeaderContent active={active} />
        <main className="flex-1">
          <div className="mx-auto max-w-[1400px] px-4 py-4 md:py-6">
            {children}
          </div>
        </main>
        <MobileNav active={active} />
      </div>
    </AppProvider>
  );
}