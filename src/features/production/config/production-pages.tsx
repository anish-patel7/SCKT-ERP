import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";

type FeaturePage = LazyExoticComponent<ComponentType<{ feature: ProductionFeatureDefinition }>>;

const outward = (
  name: "ButtaIssuesPage" | "ButtaReceiptsPage" | "MillIssuesPage" | "MillReceiptsPage",
) =>
  lazy(() =>
    import("@/features/production/pages/outward-process-pages").then((m) => ({ default: m[name] })),
  );

const movement = (
  name:
    | "BeamLoadingPage"
    | "BeamUnloadingPage"
    | "BeamIssuePage"
    | "BeamReceivePage"
    | "EmptyBeamInwardPage"
    | "BeamProductionLoadingPage",
) =>
  lazy(() =>
    import("@/features/production/warping/pages/beam-movement-pages").then((m) => ({
      default: m[name],
    })),
  );

const material = (name: "MaterialIssuesPage" | "MaterialReturnsPage" | "YarnIssueUpdatesPage") =>
  lazy(() =>
    import("@/features/production/warping/pages/beam-material-pages").then((m) => ({
      default: m[name],
    })),
  );

/**
 * Screen component per registry id (code-split). Registry entries without a page here
 * render the "Workflow specification pending" shell.
 */
export const PRODUCTION_PAGES: Record<string, FeaturePage> = {
  "rapier.job-orders": lazy(() => import("@/features/production/pages/job-orders-page")),
  "rapier.yarn-issues": lazy(() => import("@/features/production/pages/yarn-issues-page")),
  "rapier.yarn-returns": lazy(() => import("@/features/production/pages/yarn-returns-page")),
  "rapier.job-card-issues": lazy(() => import("@/features/production/pages/job-card-issues-page")),
  "rapier.daily-production": lazy(
    () => import("@/features/production/pages/daily-production-page"),
  ),
  "rapier.daily-report": lazy(() => import("@/features/production/pages/daily-report-page")),
  "rapier.job-card-receipts": lazy(
    () => import("@/features/production/pages/job-card-receipts-page"),
  ),
  "rapier.butta-issues": outward("ButtaIssuesPage"),
  "rapier.butta-receipts": outward("ButtaReceiptsPage"),
  "rapier.mill-issues": outward("MillIssuesPage"),
  "rapier.mill-receipts": outward("MillReceiptsPage"),
  "rapier.fabric-transfer": lazy(() => import("@/features/production/pages/fabric-transfer-page")),
  "rapier.cutting": lazy(() => import("@/features/production/pages/cutting-page")),
  "rapier.fabric-conversion": lazy(
    () => import("@/features/production/pages/fabric-conversion-page"),
  ),
  "warping.beam-production": lazy(
    () => import("@/features/production/warping/pages/beam-production-page"),
  ),
  "warping.beam-loading": movement("BeamLoadingPage"),
  "warping.beam-unloading": movement("BeamUnloadingPage"),
  "warping.beam-issues": movement("BeamIssuePage"),
  "warping.beam-receipts": movement("BeamReceivePage"),
  "warping.empty-beam-inward": movement("EmptyBeamInwardPage"),
  "warping.beam-production-loading": movement("BeamProductionLoadingPage"),
  "warping.material-issues": material("MaterialIssuesPage"),
  "warping.material-returns": material("MaterialReturnsPage"),
  "warping.tfo-yarn-issue": material("YarnIssueUpdatesPage"),
};
