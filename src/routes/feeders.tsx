import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Eye, Layers, Sparkles, Filter } from "lucide-react";
import { requireAuth } from "@/lib/route-guards";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSearchFeederCrossReference } from "@/hooks/useDesigns";

export const Route = createFileRoute("/feeders")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Feeder Cross-Reference — SCKT ERP" },
      {
        name: "description",
        content:
          "Feeder colourway management in SCKT ERP, the textile fabric costing and manufacturing ERP platform.",
      },
      { property: "og:title", content: "Feeder Cross-Reference — SCKT ERP" },
      {
        property: "og:description",
        content: "Feeder colourway management for textile weaving operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedersPage,
});

function FeedersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results = [] } = useSearchFeederCrossReference(searchQuery);

  return (
    <AppShell
      title="Feeder Cross-Reference"
      breadcrumb={[{ label: "Design" }, { label: "Feeder Cross-Reference" }]}
    >
      <div className="space-y-4">
        {/* Search Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search feeder, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Filter className="mr-1 size-3" /> {results.length} Cross-Reference Matches
            </Badge>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs">
                <TableHead className="font-semibold">Design Number</TableHead>
                <TableHead className="font-semibold">Design Name</TableHead>
                <TableHead className="font-semibold">Beam Colour</TableHead>
                <TableHead className="font-semibold">Feeder #</TableHead>
                <TableHead className="font-semibold">Color Name</TableHead>
                <TableHead className="font-semibold">Work</TableHead>
                <TableHead className="text-right font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {results.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono font-bold text-primary">
                    {item.designNumber}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="size-6 rounded object-cover border border-border"
                        />
                      )}
                      <span>{item.designName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-sans text-[0.6875rem]">
                      {item.beamColour}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-primary">
                    {item.feederNumber}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{item.colorName}</TableCell>
                  <TableCell className="text-muted-foreground">{item.work || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => navigate({ to: "/designs" })}
                    >
                      <Eye className="size-3.5" /> View Design
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Empty Search Results */}
        {results.length === 0 && (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center bg-card">
            <Sparkles className="size-10 text-muted-foreground/40 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">
              No feeder cross-reference matches
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              No feeders found matching "{searchQuery}". Try searching by color name (e.g.
              "N.Blue"), old number (e.g. "5831"), or beam colour.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
