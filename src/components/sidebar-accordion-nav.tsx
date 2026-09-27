import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Calculator,
  Palette,
  Factory,
  Package,
  ShoppingBag,
  ShieldCheck,
  Database,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { NavGroup, NavItem } from "@/lib/nav";
import { accessRequirementFor } from "@/lib/access-control";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<string, LucideIcon> = {
  Costing: Calculator,
  Design: Palette,
  Production: Factory,
  Inventory: Package,
  Sales: ShoppingBag,
  Quality: ShieldCheck,
  Masters: Database,
  Insights: BarChart3,
  System: Settings,
};

function isItemActive(itemTo: string, currentPath: string): boolean {
  if (itemTo === "/") return currentPath === "/";
  if (currentPath === itemTo) return true;
  return currentPath.startsWith(itemTo + "/") || currentPath.startsWith(itemTo + "?");
}

/** True when the item is a link to the current path or a section containing one. */
function containsActive(item: NavItem, currentPath: string): boolean {
  if (item.to !== undefined && isItemActive(item.to, currentPath)) return true;
  return item.children?.some((child) => containsActive(child, currentPath)) ?? false;
}

/** Keep permitted links; drop sections left without any permitted link. */
function filterNavItems(items: NavItem[], allowed: (to: string) => boolean): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.children) {
      const children = filterNavItems(item.children, allowed);
      return children.length ? [{ ...item, children }] : [];
    }
    return item.to !== undefined && allowed(item.to) ? [item] : [];
  });
}

function flattenLinks(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? flattenLinks(item.children) : [item]));
}

/** Nested menu section (e.g. Production → Rapier Module → Daily Production Section). */
function SidebarSection({
  item,
  depth,
  pathname,
  collapsed,
}: {
  item: NavItem;
  depth: number;
  pathname: string;
  collapsed: boolean;
}) {
  const active = containsActive(item, pathname);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const children = item.children ?? [];

  if (collapsed) {
    return <SidebarItems items={flattenLinks(children)} depth={depth} pathname={pathname} collapsed />;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[0.8125rem] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "font-semibold text-sidebar-accent-foreground",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 opacity-60 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
      </button>
      {open && (
        <div className="ml-3 space-y-0.5 border-l border-sidebar-border/40 pl-2">
          <SidebarItems items={children} depth={depth + 1} pathname={pathname} collapsed={false} />
        </div>
      )}
    </div>
  );
}

function SidebarItems({
  items,
  depth,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  depth: number;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <>
      {items.map((item) =>
        item.children ? (
          <SidebarSection
            key={`section:${item.label}`}
            item={item}
            depth={depth}
            pathname={pathname}
            collapsed={collapsed}
          />
        ) : item.to !== undefined ? (
          <SidebarLink
            key={item.to}
            to={item.to}
            label={item.label}
            phase={item.phase}
            collapsed={collapsed}
          />
        ) : null,
      )}
    </>
  );
}

function SidebarLink({
  to,
  label,
  collapsed,
  phase,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  phase?: number | undefined;
}) {
  return (
    <Link
      to={to}
      title={label}
      className="group flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{
        className:
          "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-sidebar-primary pl-[8px]",
      }}
      activeOptions={{ exact: false }}
    >
      <CircleDot className="size-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
      {!collapsed && (
        <span className="flex-1 truncate">
          {label}
          {phase && phase > 1 ? (
            <span className="ml-1 text-[0.625rem] font-normal text-sidebar-foreground/45">
              P{phase}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}

export function SidebarAccordionNav({
  groups: allGroups,
  collapsed,
}: {
  groups: NavGroup[];
  collapsed: boolean;
}) {
  const { canAny, isLoading: accessLoading, access, error: accessError } = usePermissions();
  const accessNotice = accessLoading
    ? null
    : accessError
      ? `Couldn't load your access: ${accessError.message}`
      : access?.blocked
        ? `Your account is ${access.status ?? "inactive"}; modules are hidden.`
        : access && access.roles.length === 0
          ? `No role is assigned to this account, so modules are hidden.${
              access.unavailableSources.length
                ? ` Could not read: ${access.unavailableSources.join(", ")}.`
                : ""
            } Ask an administrator.`
          : null;
  const groups = useMemo(() => {
    if (accessLoading) return [];
    const allowed = (to: string) => {
      const requirement = accessRequirementFor(to);
      return requirement === null || canAny(requirement.anyOf);
    };
    return allGroups
      .map((group) => ({ ...group, items: filterNavItems(group.items, allowed) }))
      .filter((group) => group.items.length > 0);
  }, [allGroups, canAny, accessLoading]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Automatically expand parent module corresponding to the active route
  useEffect(() => {
    const activeGroup = groups.find(
      (group) =>
        (group.to !== undefined && isItemActive(group.to, pathname)) ||
        group.items.some((item) => containsActive(item, pathname)),
    );
    if (activeGroup) {
      setExpandedGroup(activeGroup.label);
    }
  }, [pathname, groups]);

  const handleGroupToggle = (group: NavGroup) => {
    if (group.to !== undefined) {
      setExpandedGroup(group.label);
      void navigate({ to: group.to });
      return;
    }
    setExpandedGroup((prev) => (prev === group.label ? null : group.label));
  };

  const isDashboardActive = pathname === "/";

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 select-none">
      {/* Standalone Dashboard Nav Item */}
      <Link
        to="/"
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isDashboardActive &&
            "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary pl-[8px]",
        )}
      >
        <LayoutDashboard className="size-4 shrink-0 text-sidebar-primary" />
        {!collapsed && <span>Dashboard</span>}
      </Link>

      {accessNotice && !collapsed && (
        <p
          role="status"
          className="mx-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[0.6875rem] leading-snug text-amber-200"
        >
          {accessNotice}
        </p>
      )}

      {/* Accordion Parent Modules */}
      {groups.map((group) => {
        const IconComponent = GROUP_ICONS[group.label] || CircleDot;
        const isExpanded = expandedGroup === group.label;
        const hasActiveChild = group.items.some((item) => containsActive(item, pathname));

        return (
          <div key={group.label} className="pt-1">
            {/* Parent Module Heading / Toggle Button */}
            <button
              type="button"
              onClick={() => handleGroupToggle(group)}
              className={cn(
                "group flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                (isExpanded || hasActiveChild) && "text-sidebar-accent-foreground",
                hasActiveChild &&
                  !isExpanded &&
                  "bg-sidebar-accent/30 text-sidebar-primary font-bold",
              )}
              title={collapsed ? group.label : undefined}
            >
              <div className="flex items-center gap-2.5 truncate">
                <IconComponent
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    hasActiveChild
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground",
                  )}
                />
                {!collapsed && <span className="truncate">{group.label}</span>}
              </div>

              {!collapsed && (
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ease-in-out group-hover:text-sidebar-accent-foreground",
                    isExpanded && "rotate-180 text-sidebar-primary",
                  )}
                />
              )}
            </button>

            {/* Smooth Collapsible Submenu Container */}
            <div
              className={cn(
                "grid transition-all duration-200 ease-in-out",
                isExpanded
                  ? "grid-rows-[1fr] opacity-100 mt-0.5"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none",
              )}
            >
              <div className="overflow-hidden pl-3 space-y-0.5 border-l border-sidebar-border/40 ml-4 my-0.5">
                <SidebarItems
                  items={group.items}
                  depth={0}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
