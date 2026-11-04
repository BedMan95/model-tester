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
import { motion, useReducedMotion } from "motion/react";
import { Lightning, Sun, Moon } from "@phosphor-icons/react";

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
  const reduceMotion = useReducedMotion();

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ width: 0, transform: "translateX(0)" });
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
    setHydrated(true);
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

  const pillTransition = reduceMotion
    ? { duration: 0.01, type: "tween" as const }
    : { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-violet-500 to-fuchsia-500 text-white shadow-sm shadow-indigo-500/20">
                <Lightning className="h-4 w-4" weight="bold" />
              </span>
              <span className="font-semibold tracking-tight text-foreground">AI Model Tester Studio</span>
            </Link>
          </div>

          {/* Center: Tabs with animated pill - integrated into header */}
          <nav className="hidden md:flex flex-1 items-center justify-center" aria-label="Main navigation">
            <div className="relative flex h-10 items-center gap-0.5" ref={tabContainerRef} role="tablist">
              {/* Animated pill background */}
              {mounted && (
                <motion.div
                  className="absolute inset-y-1 rounded-full bg-brand/15 ring-1 ring-brand/30 pointer-events-none"
                  style={pillStyle as React.CSSProperties}
                  transition={pillTransition}
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
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        <HeaderContent active={active} />
        <main className="flex-1 min-h-0 overflow-hidden mx-auto max-w-[1400px] w-full px-4 py-4 md:py-6">
          {children}
        </main>
        <MobileNav active={active} />
      </div>
    </AppProvider>
  );
}
