import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

/** 右侧观测读数面板：与配置卡片区分的仪器面板。 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "frame-ticks rounded-lg border border-[var(--border-strong)] bg-[var(--panel)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 text-[11px] font-medium text-[var(--sub)]",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-8 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface2)] px-2.5 text-[13px] tabular-nums text-[var(--text)] transition-colors placeholder:text-[var(--faint)] hover:border-[var(--accent)]/50 focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20",
        className,
      )}
      {...props}
    />
  );
}

/** 原生 select 统一外观：去系统样式，加自己的箭头。 */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-8 w-full cursor-pointer appearance-none truncate rounded-md border border-[var(--border-strong)] bg-[var(--surface2)] pl-2.5 pr-7 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 12 12"
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--sub)]"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center rounded-md bg-[var(--surface2)] p-0.5", className)}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 cursor-pointer rounded px-3 text-[13px] transition-colors",
              active
                ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-sm"
                : "text-[var(--sub)] hover:text-[var(--text)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 行内提示：错误 / 警告 / 成功。 */
export function Notice({
  tone,
  className,
  children,
}: {
  tone: "danger" | "warn" | "ok";
  className?: string;
  children: React.ReactNode;
}) {
  const color =
    tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--ok)";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-[13px] leading-relaxed",
        className,
      )}
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 7%, transparent)`,
        color,
      }}
    >
      {children}
    </div>
  );
}

/** 字段格：标签在上、控件在下，队伍配置等密集表单用。 */
export function FieldCell({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)} title={hint}>
      <span className="truncate text-[11px] leading-none text-[var(--sub)]">{label}</span>
      {children}
    </label>
  );
}

/** 开关片：精英化 / 武器突破这类二态。 */
export function ToggleChip({
  on,
  onText,
  offText,
  title,
  onClick,
}: {
  on: boolean;
  onText: string;
  offText: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors",
        on
          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
          : "border-[var(--border-strong)] text-[var(--faint)] hover:text-[var(--sub)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors",
          on ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
        )}
      />
      {on ? onText : offText}
    </button>
  );
}
