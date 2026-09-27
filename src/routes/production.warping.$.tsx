import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { findFeature } from "@/features/production/config/production-features";
import { ProductionFeatureRoute } from "@/features/production/components/production-feature-route";

// All Warping Module screens: /production/warping/<slug>, resolved through the feature registry.
export const Route = createFileRoute("/production/warping/$")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: ({ params }) => {
    const title = findFeature("warping", params._splat ?? "")?.label ?? "Production";
    return { meta: [{ title: `${title} — SCKT ERP` }] };
  },
  component: WarpingRoute,
});

function WarpingRoute() {
  const { _splat } = Route.useParams();
  return <ProductionFeatureRoute module="warping" slug={_splat ?? ""} />;
}
