import Link from "next/link";
import { cn } from "@/lib/cn";
import { type ActiveKey } from "@/lib/nav";

export type TabKey = "home" | "chat" | "compare" | "history";

const NAV: { key: TabKey; label: string; href: string }[] = [
  { key: "home", label: "Tester", href: "/" },
  { key: "chat", label: "Chat", href: "/chat" },
  { key: "compare", label: "Compare", href: "/compare" },
  { key: "history", label: "History", href: "/history" },
];

export function Sidebar({ active }: { active: ActiveKey }) {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-border bg-card/40 p-3 md:flex md:flex-col md:gap-1">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 px-2 py-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </span>
        <span className="text-sm font-bold tracking-tight">
          Model Tester
          <span className="ml-1.5 rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-500">
            v2
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile-only bottom tab bar, so the app remains usable at small widths. */
export function MobileNav({ active }: { active: ActiveKey }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 p-1 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center rounded-lg py-1.5 text-[10px] font-medium",
              isActive ? "text-brand" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

