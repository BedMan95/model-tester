import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ActiveKey } from "@/lib/nav";

export type TabKey = "home" | "chat" | "compare" | "history";

const NAV: { key: TabKey; label: string; href: string }[] = [
  { key: "home", label: "Tester", href: "/" },
  { key: "chat", label: "Chat", href: "/chat" },
  { key: "compare", label: "Compare", href: "/compare" },
  { key: "history", label: "History", href: "/history" },
];

/** Mobile-only bottom tab bar — pill style for consistency. */
export function MobileNav({ active }: { active: ActiveKey }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm p-1.5 md:hidden">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex gap-1" role="tablist">
          {NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand/15 text-brand ring-1 ring-brand/30 shadow-sm"
                    : "text-muted-foreground active:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}