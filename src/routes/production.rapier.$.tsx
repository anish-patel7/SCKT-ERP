import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { findFeature } from "@/features/production/config/production-features";
import { ProductionFeatureRoute } from "@/features/production/components/production-feature-route";

// All Rapier Module screens: /production/rapier/<slug>, resolved through the feature registry.
export const Route = createFileRoute("/production/rapier/$")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: ({ params }) => {
    const title = findFeature("rapier", params._splat ?? "")?.label ?? "Production";
    return { meta: [{ title: `${title} — SCKT ERP` }] };
  },
  component: RapierRoute,
});

function RapierRoute() {
  const { _splat } = Route.useParams();
  return <ProductionFeatureRoute module="rapier" slug={_splat ?? ""} />;
}
