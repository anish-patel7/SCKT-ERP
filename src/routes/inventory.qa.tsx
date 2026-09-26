import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { Can, NoPermission } from "@/components/auth";
import { AppShell } from "@/components/app-shell";
import { QADashboard } from "@/components/inventory/qa-dashboard";

export const Route = createFileRoute("/inventory/qa")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "QA Inspection — SCKT ERP" },
      {
        name: "description",
        content: "Quality assurance inspection for inbound inventory receipts.",
      },
      { property: "og:title", content: "QA Inspection — SCKT ERP" },
      {
        property: "og:description",
        content: "Inspect and grade inbound inventory items.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: QAPage,
});

function QAPage() {
  return (
    <Can permission="inventory:write" fallback={<NoPermission />}>
      <AppShell
        title="QA Inspection"
        breadcrumb={[{ label: "Inventory" }, { label: "QA Inspection" }]}
      >
        <div className="space-y-6">
          <QADashboard />
        </div>
      </AppShell>
    </Can>
  );
}
