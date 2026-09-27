import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/route-guards";
import { Can } from "@/components/auth";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Power, Layers } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_TYPES } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmt } from "@/lib/costing";
import { getLocalYarnMaterials, type YarnMaterial } from "@/lib/material-store";
import { PartyMasterView } from "@/components/party-master-view";
import { YarnMasterView } from "@/components/yarn-master-view";
import { WarehouseMasterView } from "@/components/warehouse-master-view";
import { ItemMasterView } from "@/features/item-master/components/item-master-view";

interface GenericMasterItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  composition?: string;
  denier?: number;
  rate_per_kg?: number;
  active: boolean;
}

// Fallback seed data for generic master types
const SEED_GENERIC_MASTERS: Record<string, GenericMasterItem[]> = {
  item: [
    {
      id: "item-1",
      code: "ITEM-001",
      name: "Kashmiri Kota Pashmina Dress Fabric",
      description: "Pashmina weave with black beam",
      active: true,
    },
    {
      id: "item-2",
      code: "ITEM-002",
      name: "Silk Brocade Royal Saree Fabric",
      description: "Heavy Banarasi Jari Brocade",
      active: true,
    },
    {
      id: "item-3",
      code: "ITEM-003",
      name: "Jacquard Floral Garden Dupatta",
      description: "Multi-color floral jacquard weave",
      active: true,
    },
  ],
  jobwork_party: [
    {
      id: "jwp-1",
      code: "JWP-001",
      name: "Shree Ram Dyeing & Finishing",
      description: "Specialized in Banarasi Jari Dyeing & Sizing",
      active: true,
    },
    {
      id: "jwp-2",
      code: "JWP-002",
      name: "Vardhman Weaving Division",
      description: "High-speed airjet loom job work",
      active: true,
    },
    {
      id: "jwp-3",
      code: "JWP-003",
      name: "Kothari Processors Pvt Ltd",
      description: "RFD processing & soft finish master",
      active: true,
    },
  ],
  beam: [
    {
      id: "bm-1",
      code: "BM-101",
      name: "30 Kota Black Beam",
      description: "Ends: 5444 · Denier: 35 · Length: 1000m",
      active: true,
    },
    {
      id: "bm-2",
      code: "BM-102",
      name: "75 Beam Jari",
      description: "Ends: 224 · Denier: 160 · Length: 800m",
      active: true,
    },
    {
      id: "bm-3",
      code: "BM-103",
      name: "21 Bright Mono Beam",
      description: "Ends: 3200 · Denier: 21 · Length: 1200m",
      active: true,
    },
  ],
  loom: [
    {
      id: "lm-1",
      code: "LM-01",
      name: "Airjet Loom #01",
      description: "Tsudakoma ZAX-9200 (190cm Reed Space)",
      active: true,
    },
    {
      id: "lm-2",
      code: "LM-02",
      name: "Rapier Jacquard Loom #02",
      description: "Picanol OptiMax-i (220cm Reed Space)",
      active: true,
    },
    {
      id: "lm-3",
      code: "LM-03",
      name: "Waterjet Loom #03",
      description: "Toyota LWT-810 (190cm Reed Space)",
      active: true,
    },
  ],
  broker: [
    {
      id: "brk-1",
      code: "BRK-001",
      name: "Rajeshwar Trading Co.",
      description: "Ring Road Market, Surat · Mob: 9825100000",
      active: true,
    },
    {
      id: "brk-2",
      code: "BRK-002",
      name: "Jay Ambe Agency",
      description: "Kalupur Commercial Market, Ahmedabad",
      active: true,
    },
  ],
  salesman: [
    {
      id: "sls-1",
      code: "SLS-001",
      name: "Mukesh Mehta",
      description: "Senior Sales Manager (Surat Region)",
      active: true,
    },
    {
      id: "sls-2",
      code: "SLS-002",
      name: "Suresh Shah",
      description: "Textile Representative (Mumbai Region)",
      active: true,
    },
  ],
  beam_colour: [
    {
      id: "bc-1",
      code: "BYM-01",
      name: "Black Kota Beam Yarn",
      description: "Dark Navy / Black Warp Beam Yarn",
      active: true,
    },
    {
      id: "bc-2",
      code: "BYM-02",
      name: "Banarasi Gold Beam Yarn",
      description: "Metallic Gold Warp Beam Yarn",
      active: true,
    },
    {
      id: "bc-3",
      code: "BYM-03",
      name: "Royal Blue Beam Yarn",
      description: "Dyed Royal Blue Warp Beam Yarn",
      active: true,
    },
  ],
  process: [
    {
      id: "prc-1",
      code: "PRC-01",
      name: "Butta Cutting & Processing",
      description: "Standard Rate ₹2.00 / cut",
      active: true,
    },
    {
      id: "prc-2",
      code: "PRC-02",
      name: "Ready for Dyeing (RFD) Finish",
      description: "Standard Rate ₹0.00 / cut",
      active: true,
    },
    {
      id: "prc-3",
      code: "PRC-03",
      name: "Soft Wash & Calendar Finish",
      description: "Standard Rate ₹1.50 / metre",
      active: true,
    },
  ],
};

export const Route = createFileRoute("/masters/$type")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Master Data — SCKT ERP" },
      {
        name: "description",
        content:
          "Single-source master registers for yarn, item, party, beam, loom, broker, salesman, colour and process data.",
      },
      { property: "og:title", content: "Master Data — SCKT ERP" },
      {
        property: "og:description",
        content: "Centralised textile master data with rate history and de-duplicated records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MasterPage,
});

function masterCreatePermission(type: string): string {
  if (type === "material") return "masters.yarn:create";
  if (type === "party") return "masters.party:create";
  return "masters.generic:create";
}

function MasterPage() {
  const { type } = Route.useParams();
  const qc = useQueryClient();
  const meta = MASTER_TYPES.find((m) => m.type === type);
  const isMaterial = type === "material";
  const isParty = type === "party";
  const isWarehouse = type === "warehouse";

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GenericMasterItem | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    denier: "",
    composition: "",
    rate_per_kg: "",
  });

  // Query master records with local fallback
  const { data: dbData = [] } = useQuery({
    queryKey: ["master", type],
    enabled: !isParty,
    queryFn: async () => {
      try {
        if (isMaterial) {
          const { data, error } = await supabase.from("materials").select("*").order("code");
          if (!error && data && data.length > 0) return data;
          // Fallback to local yarn materials
          const localYarns = getLocalYarnMaterials();
          return localYarns.map((m) => ({
            id: m.id,
            code: m.code,
            name: m.name,
            composition: m.composition || "Yarn",
            denier: m.denier,
            rate_per_kg: m.ratePerKg,
            active: m.active,
          }));
        }

        const { data, error } = await supabase
          .from("masters")
          .select("*")
          .eq("master_type", type)
          .order("code");
        if (!error && data && data.length > 0) return data;

        return SEED_GENERIC_MASTERS[type] || [];
      } catch {
        if (isMaterial) {
          return getLocalYarnMaterials().map((m) => ({
            id: m.id,
            code: m.code,
            name: m.name,
            composition: m.composition || "Yarn",
            denier: m.denier,
            rate_per_kg: m.ratePerKg,
            active: m.active,
          }));
        }
        return SEED_GENERIC_MASTERS[type] || [];
      }
    },
  });

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dbData;

    return dbData.filter((r: any) => {
      const code = String(r.code || "").toLowerCase();
      const name = String(r.name || "").toLowerCase();
      const desc = String(r.description || r.composition || "").toLowerCase();
      return code.includes(q) || name.includes(q) || desc.includes(q);
    });
  }, [dbData, search]);

  if (isWarehouse) {
    return (
      <AppShell
        title="Warehouse Master"
        breadcrumb={[{ label: "Masters" }, { label: "Warehouse" }]}
      >
        <WarehouseMasterView />
      </AppShell>
    );
  }

  if (type === "item") {
    // Item Master V1 (frontend prototype). The existing list stays visible read-only.
    return (
      <AppShell title="Item Master" breadcrumb={[{ label: "Masters" }, { label: "Item" }]}>
        <ItemMasterView legacyRows={dbData as GenericMasterItem[]} />
      </AppShell>
    );
  }

  if (isParty) {
    return (
      <AppShell title="Party Master" breadcrumb={[{ label: "Masters" }, { label: "Party" }]}>
        <PartyMasterView />
      </AppShell>
    );
  }

  if (isMaterial) {
    return <YarnMasterView />;
  }

  const handleOpenCreate = () => {
    setEditingItem(null);
    const prefix = type === "beam_colour" ? "BYM" : type.slice(0, 3).toUpperCase();
    const padLen = type === "beam_colour" || type === "loom" || type === "process" ? 2 : 3;
    setForm({
      code: `${prefix}-${String(dbData.length + 1).padStart(padLen, "0")}`,
      name: "",
      description: "",
      denier: "",
      composition: "",
      rate_per_kg: "",
    });
    setOpen(true);
  };

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    const res = isMaterial
      ? await supabase.from("materials").insert({
          code: form.code,
          name: form.name,
          composition: form.composition || null,
          denier: form.denier ? Number(form.denier) : null,
          rate_per_kg: Number(form.rate_per_kg || 0),
        })
      : await supabase.from("masters").insert({
          master_type: type,
          code: form.code,
          name: form.name,
          description: form.description || null,
        });

    if (res.error) {
      toast.error(res.error.message || "Saved locally");
    } else {
      toast.success("Record added to database");
    }

    setOpen(false);
    qc.invalidateQueries({ queryKey: ["master", type] });
  };

  return (
    <AppShell
      title={`${meta?.label ?? "Master"} Master`}
      breadcrumb={[{ label: "Masters" }, { label: meta?.label ?? type }]}
      actions={
        <div className="flex items-center gap-2">
          <Can permission={masterCreatePermission(type)}>
            <Button size="sm" onClick={handleOpenCreate} className="h-7 gap-1 text-xs">
              <Plus className="size-3.5" /> New Record
            </Button>
          </Can>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${meta?.label ?? type} master by code, name, description...`}
              className="pl-9 text-xs"
            />
          </div>

          <Badge variant="secondary" className="text-xs">
            {filteredRows.length} {meta?.label ?? "Master"} Records
          </Badge>
        </div>

        {/* Master Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead className="h-8 w-32">Code</TableHead>
                  <TableHead className="h-8">Name</TableHead>
                  {isMaterial ? (
                    <>
                      <TableHead className="h-8">Composition</TableHead>
                      <TableHead className="h-8 text-right">Denier</TableHead>
                      <TableHead className="h-8 text-right">Rate / kg (GST incl)</TableHead>
                    </>
                  ) : (
                    <TableHead className="h-8">Description</TableHead>
                  )}
                  <TableHead className="h-8 w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r: Record<string, any>) => (
                  <TableRow key={String(r["id"])} className="hover:bg-muted/40">
                    <TableCell className="num py-2 font-mono font-bold text-primary">
                      {String(r["code"])}
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-foreground">
                      {String(r["name"])}
                    </TableCell>
                    {isMaterial ? (
                      <>
                        <TableCell className="py-2">{String(r["composition"] ?? "—")}</TableCell>
                        <TableCell className="num py-2 text-right font-mono">
                          {fmt(Number(r["denier"] ?? 0), 0)}
                        </TableCell>
                        <TableCell className="num py-2 text-right font-mono font-bold text-foreground">
                          ₹{fmt(Number(r["rate_per_kg"] ?? 0), 2)}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="py-2 text-muted-foreground">
                        {String(r["description"] ?? "—")}
                      </TableCell>
                    )}
                    <TableCell className="py-2">
                      <Badge
                        variant={r["active"] !== false ? "default" : "secondary"}
                        className={`text-[0.625rem] capitalize ${
                          r["active"] !== false
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                      >
                        {r["active"] !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredRows.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Layers className="mx-auto size-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-semibold">No records in this master yet.</p>
                      <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
                        Click "+ New Record" to add entry.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New Record Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              New {meta?.label ?? type} Record
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Code *</Label>
              <Input
                className="h-8 text-xs font-mono font-bold"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Name *</Label>
              <Input
                className="h-8 text-xs font-semibold"
                placeholder="e.g. Special Finish Master"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {isMaterial ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Composition</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. 100% Polyester"
                    value={form.composition}
                    onChange={(e) => setForm({ ...form, composition: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Denier</Label>
                    <Input
                      type="number"
                      className="num h-8 text-xs font-mono"
                      value={form.denier}
                      onChange={(e) => setForm({ ...form, denier: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Rate / kg (GST incl)</Label>
                    <Input
                      type="number"
                      className="num h-8 text-xs font-mono"
                      value={form.rate_per_kg}
                      onChange={(e) => setForm({ ...form, rate_per_kg: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Description</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Additional master specifications..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Can permission={masterCreatePermission(type)}>
              <Button size="sm" onClick={create} className="h-8 text-xs font-semibold">
                Save Record
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
