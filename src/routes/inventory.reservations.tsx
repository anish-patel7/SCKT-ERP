import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { Can, NoPermission } from "@/components/auth";
import { AppShell } from "@/components/app-shell";
import { ReservationApprovalDashboard } from "@/components/inventory/reservation-approval-dashboard";

export const Route = createFileRoute("/inventory/reservations")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Stock Reservations — SCKT ERP" },
      {
        name: "description",
        content: "Manage and approve stock reservations for inventory items.",
      },
      { property: "og:title", content: "Stock Reservations — SCKT ERP" },
      {
        property: "og:description",
        content: "Review and approve pending stock reservations.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  return (
    <Can permission="inventory:write" fallback={<NoPermission />}>
      <AppShell
        title="Stock Reservations"
        breadcrumb={[{ label: "Inventory" }, { label: "Reservations" }]}
      >
        <div className="space-y-6">
          <ReservationApprovalDashboard />
        </div>
      </AppShell>
    </Can>
  );
}
