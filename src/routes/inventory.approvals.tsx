import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { Can, NoPermission } from "@/components/auth";
import { AppShell } from "@/components/app-shell";
import { InboundApprovalDashboard } from "@/components/inventory/inbound-approval-dashboard";

export const Route = createFileRoute("/inventory/approvals")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Inbound Approvals — SCKT ERP" },
      {
        name: "description",
        content: "Manager approval for QA-inspected inbound inventory receipts.",
      },
      { property: "og:title", content: "Inbound Approvals — SCKT ERP" },
      {
        property: "og:description",
        content: "Review and approve quality-inspected inbound items.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <Can permission="inventory:write" fallback={<NoPermission />}>
      <AppShell
        title="Inbound Approvals"
        breadcrumb={[{ label: "Inventory" }, { label: "Approvals" }]}
      >
        <div className="space-y-6">
          <InboundApprovalDashboard />
        </div>
      </AppShell>
    </Can>
  );
}
