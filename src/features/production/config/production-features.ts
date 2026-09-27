/**
 * Production feature registry — the single source for the Rapier / Warping menu, route
 * paths, page titles and breadcrumbs. Adding a screen here makes it routable and visible.
 *
 * `futurePermissionResource` is METADATA ONLY for the future RBAC design. It is not an
 * active permission code; today every Production screen is guarded by `production:read`
 * (route) and `production:create` (Add New), from the current catalog.
 */
import type { NavItem } from "@/lib/nav";

export type ProductionModule = "rapier" | "warping";

export type ProductionFeatureStatus =
  /** Screen built from supplied requirements, running on the frontend demo adapter. */
  | "demo"
  /** Only a route shell: detailed screenshots / requirements not supplied yet. */
  | "spec_pending";

export type ProductionFeatureDefinition = {
  id: string;
  module: ProductionModule;
  /** Optional sub-section inside the module menu. */
  group?: string;
  label: string;
  /** Path below /production/<module>/ */
  slug: string;
  status: ProductionFeatureStatus;
  futurePermissionResource: string;
  description: string;
};

export const PRODUCTION_MODULE_LABELS: Record<ProductionModule, string> = {
  rapier: "Rapier Module",
  warping: "Warping Module",
};

export const DAILY_PRODUCTION_GROUP = "Daily Production Section";

/** Warping screens built from the old Beam Store functions (slug → description). */
const WARPING_BUILT: Record<string, string> = {
  "beam-production":
    "Warped beam entry and beam register: set, warp yarn, ends, length, rack, status, QR label.",
  "beam-loading": "Loads an in-store beam on a loom.",
  "beam-unloading": "Takes a beam off its loom back to store, sizing or depleted.",
};

export const PRODUCTION_FEATURES: readonly ProductionFeatureDefinition[] = [
  // --- Rapier ---------------------------------------------------------------
  {
    id: "rapier.job-orders",
    module: "rapier",
    label: "Job Order Entry",
    slug: "job-orders",
    status: "demo",
    futurePermissionResource: "production.rapier.job_orders",
    description: "Job orders against sales orders: item, yarn, quantity and rate.",
  },
  {
    id: "rapier.yarn-issues",
    module: "rapier",
    label: "Yarn Issue Entry",
    slug: "yarn-issues",
    status: "demo",
    futurePermissionResource: "production.rapier.yarn_issue",
    description: "Yarn issued from a warehouse against a job order.",
  },
  {
    id: "rapier.yarn-returns",
    module: "rapier",
    label: "Yarn Return Entry",
    slug: "yarn-returns",
    status: "demo",
    futurePermissionResource: "production.rapier.yarn_return",
    description: "Yarn returned against an original yarn issue.",
  },
  {
    id: "rapier.job-card-issues",
    module: "rapier",
    label: "Job Card Issue Entry",
    slug: "job-cards/issues",
    status: "demo",
    futurePermissionResource: "production.rapier.job_cards",
    description: "Job cards issued to a machine / loom against a job order.",
  },
  {
    id: "rapier.daily-production",
    module: "rapier",
    group: DAILY_PRODUCTION_GROUP,
    label: "Daily Job Card Production Entry",
    slug: "job-cards/daily-production",
    status: "demo",
    futurePermissionResource: "production.rapier.daily_production",
    description: "Daily production recorded against open job cards.",
  },
  {
    id: "rapier.daily-report",
    module: "rapier",
    group: DAILY_PRODUCTION_GROUP,
    label: "Daily Job Card Production Report",
    slug: "job-cards/daily-report",
    status: "demo",
    futurePermissionResource: "production.rapier.daily_production",
    description: "Daily production report with dimension filters.",
  },
  {
    id: "rapier.job-card-receipts",
    module: "rapier",
    label: "Job Card Receive Entry",
    slug: "job-cards/receipts",
    status: "demo",
    futurePermissionResource: "production.rapier.job_cards",
    description: "Fabric received against an issued job card.",
  },
  {
    id: "rapier.butta-issues",
    module: "rapier",
    label: "Butta Cutting Issue Entry",
    slug: "butta-cutting/issues",
    status: "demo",
    futurePermissionResource: "production.rapier.butta_cutting",
    description: "Fabric issued to a mill / job work party for butta cutting.",
  },
  {
    id: "rapier.butta-receipts",
    module: "rapier",
    label: "Butta Cutting Receive Entry",
    slug: "butta-cutting/receipts",
    status: "demo",
    futurePermissionResource: "production.rapier.butta_cutting",
    description: "Fabric received back after butta cutting.",
  },
  {
    id: "rapier.mill-issues",
    module: "rapier",
    label: "Mill Issue Entry",
    slug: "mill/issues",
    status: "demo",
    futurePermissionResource: "production.rapier.mill_processing",
    description: "Fabric issued to a mill / job work party.",
  },
  {
    id: "rapier.mill-receipts",
    module: "rapier",
    label: "Mill Receive Entry",
    slug: "mill/receipts",
    status: "demo",
    futurePermissionResource: "production.rapier.mill_processing",
    description: "Fabric received back from the mill.",
  },
  {
    id: "rapier.fabric-transfer",
    module: "rapier",
    label: "Fabric Stock Transfer Entry",
    slug: "fabric-transfer",
    status: "demo",
    futurePermissionResource: "production.rapier.stock_transfer",
    description: "Fabric moved from one warehouse to another.",
  },
  {
    id: "rapier.cutting",
    module: "rapier",
    label: "Cutting Entry",
    slug: "cutting",
    status: "demo",
    futurePermissionResource: "production.rapier.cutting",
    description: "Cutting against sales order and job order, by grade.",
  },
  {
    id: "rapier.fabric-conversion",
    module: "rapier",
    label: "Fabric Stock Convert Entry",
    slug: "fabric-conversion",
    status: "demo",
    futurePermissionResource: "production.rapier.fabric_conversion",
    description: "Stock transformation: stock out lines converted into stock in lines.",
  },
  // --- Warping ----------------------------------------------------------------
  // Beam Production / Loading / Unload reuse the old Beam Store functions (beam entry,
  // loom allocation, status & location, QR / thermal label). The rest are route shells
  // until their screenshots are supplied.
  ...(
    [
      ["beam-issues", "Beam Issue Entry (Empty Beam)", "beam_issue"],
      ["material-issues", "Material Issue For Beam Production", "beam_material_issue"],
      ["material-returns", "Beam Material Return Entry", "beam_material_return"],
      ["beam-receipts", "Beam Receive Entry", "beam_receive"],
      ["beam-loading", "Beam Loading Entry", "beam_loading"],
      ["beam-unloading", "Beam Unload Entry", "beam_unload"],
      ["empty-beam-inward", "Empty Beam Inward Entry", "empty_beam_inward"],
      ["beam-production", "Beam Production Entry", "beam_production"],
      ["beam-production-loading", "Beam Production Loading Entry", "beam_production_loading"],
      ["tfo-yarn-issue", "TFO & Beam Yarn Issue Updation", "tfo_beam_yarn_issue"],
    ] as const
  ).map(([slug, label, resource]): ProductionFeatureDefinition => {
    const built = WARPING_BUILT[slug];
    return {
      id: `warping.${slug}`,
      module: "warping",
      label,
      slug,
      status: built ? "demo" : "spec_pending",
      futurePermissionResource: `production.warping.${resource}`,
      description: built ?? "Workflow specification pending.",
    };
  }),
];

export function featurePath(feature: ProductionFeatureDefinition): string {
  return `/production/${feature.module}/${feature.slug}`;
}

export function findFeature(
  module: ProductionModule,
  slug: string,
): ProductionFeatureDefinition | undefined {
  const clean = slug.replace(/^\/+|\/+$/g, "");
  return PRODUCTION_FEATURES.find((f) => f.module === module && f.slug === clean);
}

export function featureById(id: string): ProductionFeatureDefinition {
  const feature = PRODUCTION_FEATURES.find((f) => f.id === id);
  if (!feature) throw new Error(`Unknown production feature ${id}`);
  return feature;
}

/** Menu entries for one module, with grouped features nested under their section. */
export function productionModuleNav(module: ProductionModule): NavItem {
  const children: NavItem[] = [];
  for (const feature of PRODUCTION_FEATURES.filter((f) => f.module === module)) {
    const link: NavItem = { label: feature.label, to: featurePath(feature) };
    if (!feature.group) {
      children.push(link);
      continue;
    }
    let section = children.find((c) => c.label === feature.group && c.children);
    if (!section) {
      section = { label: feature.group, children: [] };
      children.push(section);
    }
    section.children?.push(link);
  }
  return { label: PRODUCTION_MODULE_LABELS[module], children };
}

export function featureBreadcrumb(
  feature: ProductionFeatureDefinition,
): { label: string; to?: string }[] {
  return [
    { label: "Production" },
    { label: PRODUCTION_MODULE_LABELS[feature.module] },
    ...(feature.group ? [{ label: feature.group }] : []),
    { label: feature.label },
  ];
}
