import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FlaskConical,
  ScanSearch,
  Brain,
  History,
  Database,
  Settings,
  Search,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { overviewQuery, hindsightStatusQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/experiments", label: "Experiments", icon: FlaskConical },
  { to: "/app/audit", label: "Chrono Audit", icon: ScanSearch },
  { to: "/app/memory", label: "Memory Intelligence", icon: Brain },
  { to: "/app/reaudit", label: "Knowledge Replay", icon: History },
  { to: "/app/memory", label: "Revision Alerts", icon: History },
  { to: "/app/data-sources", label: "Data Sources", icon: Database },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data } = useQuery({ ...overviewQuery, staleTime: 30_000 });
  const { data: hs } = useQuery(hindsightStatusQuery);
  const connected = hs?.connected === true;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link to="/">
            <Logo />
          </Link>
          <button
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Project selector */}
        <div className="px-3 pt-3">
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-foreground/15">
            <span className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-md bg-hindsight-soft font-mono text-[11px] font-bold text-hindsight">
                AQ
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-medium text-foreground">Atlas Quant Research</span>
                <span className="text-[10px] text-muted-foreground">6 experiments · Hindsight sync on</span>
              </span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} onNavigate={() => setMenuOpen(false)} />
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg border border-hindsight/25 bg-hindsight-soft p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-hindsight">Hindsight</span>
              <span className={cn("flex items-center gap-1.5 text-[10px]", connected ? "text-safe" : "text-warn")}>
                <span className={cn("size-1.5 rounded-full animate-blink", connected ? "bg-safe" : "bg-warn")} />
                {hs ? (connected ? "Connected" : "Demo Fallback") : "Checking…"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {data ? `${data.stats.memoryCount} memories retained` : "Memory layer active"}
            </p>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
          <button
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-4.5" />
          </button>

          <button className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-foreground/85 transition-colors hover:border-foreground/15 md:flex">
            Atlas Quant Research
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

          <div className="relative ml-auto hidden w-64 md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search experiments, features, memories…"
              className="h-8.5 w-full rounded-lg border border-border bg-card pl-8 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-hindsight/40 focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-secondary px-1 font-mono text-[9px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2.5 md:ml-0">
            <span className="hidden items-center gap-1.5 rounded-lg border border-hindsight/25 bg-hindsight-soft px-2.5 py-1.5 text-[11px] font-medium text-hindsight sm:flex">
              <Brain className="size-3.5" />
              {data ? `${data.stats.memoryCount} memories` : "Hindsight"}
            </span>
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium md:flex",
                connected ? "border-safe/25 bg-safe-soft text-safe" : "border-warn/25 bg-warn-soft text-warn",
              )}
            >
              <span className={cn("size-1.5 rounded-full animate-blink", connected ? "bg-safe" : "bg-warn")} />
              {hs ? (connected ? "Hindsight Connected" : "Demo Memory Fallback") : "Checking Hindsight…"}
            </span>
            <div className="grid size-8 place-items-center rounded-full border border-border bg-gradient-to-br from-secondary to-accent text-[11px] font-bold text-foreground">
              DS
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Link
      to={to}
      hash={label === "Revision Alerts" ? "timeline" : ""}
      activeOptions={{ exact: Boolean(exact) || to === "/app/memory", includeHash: true }}
      className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
      onClick={onNavigate}
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          <Icon className={cn("size-4", isActive ? "text-hindsight" : "text-muted-foreground group-hover:text-foreground")} />
          {label}
          {isActive && <span className="ml-auto size-1.5 rounded-full bg-hindsight" />}
        </>
      )}
    </Link>
  );
}
