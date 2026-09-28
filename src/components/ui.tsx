import { cn } from "@/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        variant === "primary" &&
          "bg-brand text-brand-foreground hover:opacity-90 shadow-sm",
        variant === "ghost" &&
          "hover:bg-muted text-foreground",
        variant === "outline" &&
          "border border-border bg-card hover:bg-muted text-foreground",
        variant === "danger" &&
          "border border-rose-300 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h4>
      {action}
    </div>
  );
}

/**
 * Searchable model picker over a native <datalist>.
 *
 * Model catalogs run past a hundred entries (the legacy app shipped the same
 * problem and solved it with TomSelect); a plain <select> is unusable there.
 * datalist gives type-ahead filtering with no dependency and keeps the
 * keyboard-tab semantics of a real input.
 */
export function ModelSelect({
  value,
  onChange,
  models,
  placeholder = "Select a model…",
  className,
}: {
  value: string;
  onChange: (model: string) => void;
  models: string[];
  placeholder?: string;
  className?: string;
}) {
  const listId = `ms-${Math.random().toString(36).slice(2, 8)}`;
  const exact = models.includes(value);

  return (
    <div className="relative">
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // datalist can leave a partial string on tab/enter; snap to the
          // unique completion when the typed text is a prefix, else revert to
          // the last exact match so we never send a truncated model id.
          if (exact) return;
          const hits = models.filter((m) => m.startsWith(value.trim()));
          if (hits.length === 1) onChange(hits[0]);
        }}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-card px-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand",
          !exact && "border-amber-400 dark:border-amber-600",
          className,
        )}
      />
      <datalist id={listId}>
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
