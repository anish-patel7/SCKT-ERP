import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Plus,
  LogOut,
  CircleDot,
} from "lucide-react";
import { SidebarAccordionNav } from "@/components/sidebar-accordion-nav";
import { PasswordChangeGate } from "@/components/auth/password-change-gate";
import { NAV } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AppShell({
  title,
  breadcrumb = [],
  actions,
  children,
}: {
  title: string;
  breadcrumb?: { label: string; to?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  // On phones the full sidebar would leave the page only ~150px wide: start collapsed to the
  // icon rail, open it as an overlay, and close it again after navigating.
  const overlayOpen = isMobile && !collapsed;

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile, pathname]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="section-label">Loading SCKT…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {overlayOpen && (
        <>
          <div className="w-16 shrink-0" aria-hidden />
          <div
            className="fixed inset-0 z-30 bg-black/40"
            aria-hidden
            onClick={() => setCollapsed(true)}
          />
        </>
      )}
      <aside
        className={cn(
          "top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width]",
          overlayOpen ? "fixed left-0 z-40" : "sticky",
          collapsed ? "w-16" : "w-[236px]",
        )}
      >
        <div className="flex h-11 items-center gap-2 border-b border-sidebar-border px-3">
          <img
            src="/ck-logo.png"
            alt="Chehar Krupa Logo"
            className="h-7 w-auto object-contain filter drop-shadow-md"
          />
          {!collapsed && (
            <span className="text-sm font-bold tracking-wider text-sidebar-accent-foreground">
              SCKT
            </span>
          )}
        </div>

        <SidebarAccordionNav groups={NAV} collapsed={collapsed} />

        <div className="flex items-center gap-2 border-t border-sidebar-border px-3 py-2 text-[0.6875rem] text-sidebar-foreground/70">
          <span className="size-1.5 rounded-full bg-success" />
          {!collapsed && <span>Database connected</span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-11 items-center gap-3 border-b bg-surface px-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>

          <nav className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            {breadcrumb.map((b) => (
              <span key={b.label} className="flex items-center gap-1">
                <span className="opacity-40">›</span>
                {b.to ? (
                  <Link to={b.to} className="hover:text-foreground">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{b.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="relative ml-auto hidden w-72 lg:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search designs, sheets, yarn…" className="h-7 pl-7 text-xs" />
          </div>

          <Button asChild size="sm" className="h-7 gap-1 px-2 text-xs">
            <Link to="/cost-sheets/new">
              <Plus className="size-3.5" /> New
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>
          <Badge
            variant="secondary"
            className="hidden max-w-40 truncate text-[0.6875rem] sm:inline-flex"
          >
            {user.email}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Sign out"
            onClick={async () => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("sckt_demo_user");
              }
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        <main className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <LayoutDashboard className="size-4 text-primary" />
              {title}
            </h1>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
          {children}
        </main>
        <PasswordChangeGate />
      </div>
    </div>
  );
}
