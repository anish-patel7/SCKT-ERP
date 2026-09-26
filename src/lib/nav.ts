export type NavItem = {
  label: string;
  to: string;
  phase?: number;
};

export type NavGroup = {
  label: string;
  to?: string;
  items: NavItem[];
};

export const MASTER_TYPES = [
  { type: "material", label: "Yarn" },
  { type: "item", label: "Item" },
  { type: "party", label: "Party" },
  { type: "warehouse", label: "Warehouse" },
  { type: "jobwork_party", label: "Job Work Party" },
  { type: "beam", label: "Beam" },
  { type: "loom", label: "Loom" },
  { type: "broker", label: "Broker" },
  { type: "salesman", label: "Salesman" },
  { type: "beam_colour", label: "Beam Yarn" },
  { type: "process", label: "Process" },
] as const;

export const NAV: NavGroup[] = [
  {
    label: "Costing",
    items: [
      { label: "Cost Sheets", to: "/cost-sheets" },
      { label: "Approvals", to: "/approvals" },
    ],
  },
  {
    label: "Design",
    items: [
      { label: "Designs", to: "/designs" },
      { label: "Image Gallery", to: "/gallery" },
      { label: "Feeder Cross-Reference", to: "/feeders" },
    ],
  },
  {
    label: "Production",
    items: [
      { label: "Production Orders", to: "/production/orders" },
      { label: "Loom Planning", to: "/production/looms" },
      { label: "Job Cards", to: "/production/job-cards" },
      { label: "Daily Production", to: "/production/daily" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Yarn Store", to: "/inventory/yarn" },
      { label: "Beam Store", to: "/inventory/beam" },
      { label: "Grey / Finished", to: "/inventory/fabric" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Customers", to: "/sales/customers" },
      { label: "Quotations", to: "/sales/quotations" },
      { label: "Orders & Dispatch", to: "/sales/orders" },
      { label: "Outstanding", to: "/sales/outstanding" },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Inspection", to: "/quality/inspection" },
      { label: "Shade Approval", to: "/quality/shade" },
    ],
  },
  {
    label: "Masters",
    items: MASTER_TYPES.map((m) => ({ label: m.label, to: `/masters/${m.type}` })),
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", to: "/reports" },
      { label: "Analytics", to: "/analytics" },
    ],
  },
  {
    label: "System",
    to: "/system",
    items: [
      { label: "WhatsApp Bot", to: "/system/whatsapp" },
      { label: "Users & Roles", to: "/system/users" },
      { label: "Roles & Permissions", to: "/system/roles" },
      { label: "Permission Matrix", to: "/system/permission-matrix" },
      { label: "Settings", to: "/system/settings" },
      { label: "Audit History", to: "/system/audit" },
      { label: "Backup & Restore", to: "/system/backup", phase: 1 },
    ],
  },
];
