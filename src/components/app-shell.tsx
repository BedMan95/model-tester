import type { ReactNode } from "react";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppProvider } from "@/components/app-store";
import type { ActiveKey } from "@/lib/nav";

export interface AppShellProps {
  active: ActiveKey;
  children: ReactNode;
}

/**
 * Wraps each of the four app pages. Because state lives in <AppProvider>,
 * it survives client-side navigation between tabs — switching from Tester to
 * Chat and back keeps models, creds, and history intact.
 */
export function AppShell({ active, children }: AppShellProps) {
  return (
    <AppProvider>
      <div className="flex min-h-screen">
        <Sidebar active={active} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground md:hidden">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-indigo-600 to-violet-500 text-[10px] text-white">
                ⚡
              </span>
              Model Tester
            </div>
            <div className="hidden md:block" />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 pb-16 md:pb-4">{children}</main>
        </div>
        <MobileNav active={active} />
      </div>
    </AppProvider>
  );
}
