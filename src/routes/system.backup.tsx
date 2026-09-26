import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/system/backup")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Backup & Restore — SCKT ERP" },
      {
        name: "description",
        content:
          "Backup, restore & data retention in SCKT ERP, the textile fabric costing and manufacturing ERP platform.",
      },
      { property: "og:title", content: "Backup & Restore — SCKT ERP" },
      {
        property: "og:description",
        content: "Backup, restore & data retention for textile weaving operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModulePlaceholder
      title="Backup & Restore"
      moduleId="M17"
      phase={1}
      purpose="Backup, restore & data retention."
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Backup & Restore" }]}
      features={[
        "Scheduled database backups",
        "Point-in-time restore",
        "Retention policy per entity",
      ]}
    />
  );
}
