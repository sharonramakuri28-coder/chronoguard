import { cn } from "@/lib/utils";

export function LeakageAlert({
  title,
  className,
  children,
  icon,
}: {
  title: string;
  className?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-leak/30 bg-leak-soft shadow-[var(--shadow-leak)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-leak/25 bg-leak/10 px-4 py-3">
        {icon ?? (
          <svg className="size-5 shrink-0 text-leak" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        )}
        <h3 className="text-sm font-bold uppercase tracking-widest text-leak">{title}</h3>
      </div>
      {children && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}
