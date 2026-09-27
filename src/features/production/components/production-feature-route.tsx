import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  PRODUCTION_MODULE_LABELS,
  findFeature,
  type ProductionModule,
} from "@/features/production/config/production-features";
import { PRODUCTION_PAGES } from "@/features/production/config/production-pages";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import { PendingSpecPage } from "@/features/production/components/pending-spec-page";

/** Resolves /production/<module>/<slug> through the feature registry. */
export function ProductionFeatureRoute({
  module,
  slug,
}: {
  module: ProductionModule;
  slug: string;
}) {
  const feature = findFeature(module, slug);
  if (!feature) {
    return (
      <AppShell
        title="Screen not found"
        breadcrumb={[{ label: "Production" }, { label: PRODUCTION_MODULE_LABELS[module] }]}
      >
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {PRODUCTION_MODULE_LABELS[module]} screen at this address.{" "}
            <Link to="/" className="text-primary hover:underline">
              Go to dashboard
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }
  const Page = PRODUCTION_PAGES[feature.id];
  if (!Page) {
    return (
      <ProductionPageShell feature={feature}>
        <PendingSpecPage feature={feature} />
      </ProductionPageShell>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading {feature.label}…
        </div>
      }
    >
      <Page feature={feature} />
    </Suspense>
  );
}
