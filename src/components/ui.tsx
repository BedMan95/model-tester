import { cn } from "@/lib/cn";
import { useState, useRef, useEffect, useCallback } from "react";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50",
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
      {...(disabled ? { disabled: true } : {})}
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
        "rounded-lg border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm",
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
 * ModelSelect - Searchable dropdown with consistent design
 * Uses a portal-free dropdown that works with any container
 */
export function ModelSelect({
  value,
  onChange,
  models,
  placeholder = "Select a model…",
  className,
  disabled = false,
  loading = false,
  maxHeight = 280,
}: {
  value: string;
  onChange: (model: string) => void;
  models: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  maxHeight?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);


  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exactMatch = models.includes(value);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setIsOpen(true);
        setSearchQuery("");
        setHighlightedIndex(0);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, filteredModels.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredModels[highlightedIndex]) {
            onChange(filteredModels[highlightedIndex]);
            setIsOpen(false);
            setSearchQuery("");
            setHighlightedIndex(-1);
          } else if (searchQuery.trim() && filteredModels.length === 1) {
            onChange(filteredModels[0]);
            setIsOpen(false);
            setSearchQuery("");
            setHighlightedIndex(-1);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
          inputRef.current?.blur();
          break;
        case "Tab":
          if (highlightedIndex >= 0 && filteredModels[highlightedIndex]) {
            e.preventDefault();
            onChange(filteredModels[highlightedIndex]);
          }
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, filteredModels, highlightedIndex, onChange]
  );

  // Sync highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const option = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (option) {
        option.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered models change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    // Allow typing freely, but don't call onChange until selection
  };

  const handleBlur = () => {
    // Delay to allow click on option to register
    setTimeout(() => {
      if (exactMatch) return;
      const hits = models.filter((m) => m.startsWith(value.trim()));
      if (hits.length === 1) onChange(hits[0]);
    }, 200);
  };

  const selectModel = (model: string) => {
    onChange(model);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 h-9 w-full rounded-md border bg-card px-3 text-sm font-mono text-foreground transition-colors",
            "focus-within:ring-2 focus-within:ring-brand focus-within:border-transparent",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "ring-2 ring-brand border-transparent",
            loading && "border-sky-500/50",
            !exactMatch && value && "border-amber-400 dark:border-amber-600",
          )}
          onClick={(e) => {
            if (disabled) return;
            // Only toggle if we're not clicking the input itself
            if (e.target !== inputRef.current) {
              setIsOpen((prev) => !prev);
            }
          }}
        >
          <MagnifyingGlass className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" weight="regular" />

          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchQuery : value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-mono min-w-0"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? "model-options" : undefined}
            role="combobox"
          />

          {value && !disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center justify-center p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" weight="regular" />
            </button>
          )}

          {(loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent text-sky-500" />
          ) : (
            <span className={cn(
              "flex items-center justify-center h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
              isOpen && "rotate-180"
            )}>
              <CaretDown className="h-3.5 w-3.5" weight="regular" />
            </span>
        ))}
      </div>

        {isOpen && (
          <div
            id="model-options"
            ref={optionsRef}
            className="absolute z-[100] top-full left-0 mt-1.5 w-full rounded-md border border-border bg-card shadow-xl overflow-hidden"
            style={{ maxHeight }}
            role="listbox"
          >
            {searchQuery && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                {filteredModels.length} of {models.length} models
              </div>
            )}

            {filteredModels.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {models.length === 0 ? (
                  <>
                    <span className="block">No models available</span>
                    <span className="text-xs mt-1">Load models in Tester tab</span>
                  </>
                ) : searchQuery ? (
                  `No matches for "${searchQuery}"`
                ) : (
                  "No models available"
                )}
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                {filteredModels.map((model, index) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => selectModel(model)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm font-mono transition-colors",
                      "hover:bg-brand/5 hover:text-brand",
                      index === highlightedIndex && "bg-brand/10 text-brand",
                      value === model && "bg-brand/10 text-brand font-medium",
                    )}
                    role="option"
                    aria-selected={value === model}
                  >
                    <span className="truncate block">{model}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ProviderSelect - styled dropdown mirroring ModelSelect, fixed option list.
 */
export function ProviderSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = options.find((o) => o.value === value);

  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm font-mono text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      >
        <span className="truncate flex-1 text-left">{active?.label ?? value}</span>
        <CaretDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150", open && "rotate-180")}
          weight="regular"
        />
      </button>

      {open && (
        <div className="absolute z-[100] top-full left-0 mt-1.5 w-full rounded-md border border-border bg-card shadow-xl overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto" role="listbox">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm font-mono transition-colors",
                  o.value === value ? "bg-brand/10 text-brand font-medium" : "hover:bg-brand/5 hover:text-brand",
                )}
              >
                <span className="block truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}