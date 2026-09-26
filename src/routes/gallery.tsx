import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Eye, Edit, Copy, Layers, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { DesignWithDetails } from "@/types/design";
import { getErrorMessage, useCloneDesign, useDesigns } from "@/hooks/useDesigns";

export const Route = createFileRoute("/gallery")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Image Gallery — SCKT ERP" },
      {
        name: "description",
        content:
          "Fabric image gallery & file management in SCKT ERP, the textile fabric costing and manufacturing ERP platform.",
      },
      { property: "og:title", content: "Image Gallery — SCKT ERP" },
      {
        property: "og:description",
        content: "Fabric image gallery & file management for textile weaving operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImageModal, setSelectedImageModal] = useState<DesignWithDetails | null>(null);

  const { data: allDesigns = [] } = useDesigns();
  const cloneDesign = useCloneDesign();

  // Filter gallery items
  const q = searchQuery.trim().toLowerCase();
  const galleryDesigns = allDesigns.filter((d) => {
    if (!q) return true;
    return (
      d.designNumber.toLowerCase().includes(q) ||
      d.designName.toLowerCase().includes(q) ||
      (d.dn && d.dn.toLowerCase().includes(q)) ||
      (d.work && d.work.toLowerCase().includes(q)) ||
      d.beamColours.some((bc) => bc.beamColour.toLowerCase().includes(q))
    );
  });

  const handleCloneFromGallery = (design: DesignWithDetails) => {
    const nextNum = `${design.designNumber}-CLONE`;
    cloneDesign.mutate(
      {
        originalId: design.id,
        newDesignNumber: nextNum,
        newDesignName: `${design.designName} (Copy)`,
      },
      {
        onSuccess: (cloned) => {
          toast.success(`Design ${cloned.designNumber} cloned successfully!`);
          navigate({ to: "/designs" });
        },
        onError: (err) => toast.error(`Unable to clone design: ${getErrorMessage(err)}`),
      },
    );
  };

  return (
    <AppShell title="Image Gallery" breadcrumb={[{ label: "Design" }, { label: "Image Gallery" }]}>
      <div className="space-y-4">
        {/* Gallery Search Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search design number, name, DN, work, beam colour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <Badge variant="secondary" className="text-xs">
            Showing {galleryDesigns.length} Gallery Swatches
          </Badge>
        </div>

        {/* Gallery Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {galleryDesigns.map((design) => {
            const feederCount = design.beamColours.reduce((sum, bc) => sum + bc.feeders.length, 0);

            return (
              <Card
                key={design.id}
                className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-md"
              >
                {/* Image Box */}
                <div
                  className="relative aspect-square w-full cursor-pointer overflow-hidden bg-muted"
                  onClick={() => setSelectedImageModal(design)}
                  title="Click for full resolution image preview"
                >
                  {design.image ? (
                    <img
                      src={design.image}
                      alt={design.designName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-muted to-accent/40 text-muted-foreground">
                      <ImageIcon className="size-10 opacity-30" />
                      <span className="mt-1 text-xs">No Swatch Uploaded</span>
                    </div>
                  )}

                  <div className="absolute left-2 top-2">
                    <Badge className="bg-background/90 font-mono text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
                      {design.designNumber}
                    </Badge>
                  </div>

                  {design.work && (
                    <div className="absolute right-2 top-2">
                      <Badge variant="secondary" className="text-[0.625rem]">
                        {design.work}
                      </Badge>
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
                      🔍 View Full Preview
                    </span>
                  </div>
                </div>

                {/* Card Info */}
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {design.designName}
                    </h3>
                    <p className="text-[0.6875rem] text-muted-foreground font-mono">
                      {design.dn ? `${design.dn} · ` : ""}Reed {design.reed || "—"} / Pick{" "}
                      {design.pick || "—"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Layers className="size-3.5 text-primary" /> {design.beamColours.length} Beam
                      Colours
                    </span>
                    <span className="font-mono text-[0.6875rem]">{feederCount} Feeders</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => navigate({ to: "/designs" })}
                    >
                      <Eye className="mr-1 size-3" /> View Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCloneFromGallery(design)}
                      title="Clone Design"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {galleryDesigns.length === 0 && (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center bg-card">
            <Sparkles className="size-10 text-muted-foreground/40 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No gallery images found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              No matching design images for "{searchQuery}".
            </p>
          </div>
        )}
      </div>

      {/* LIGHTBOX PREVIEW MODAL */}
      <Dialog
        open={Boolean(selectedImageModal)}
        onOpenChange={(open) => !open && setSelectedImageModal(null)}
      >
        <DialogContent className="max-w-3xl">
          {selectedImageModal && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className="font-mono text-primary">{selectedImageModal.designNumber}</span>{" "}
                  — {selectedImageModal.designName}
                </DialogTitle>
              </DialogHeader>

              <div className="overflow-hidden rounded-lg border border-border bg-black/90 flex items-center justify-center p-2">
                {selectedImageModal.image ? (
                  <img
                    src={selectedImageModal.image}
                    alt={selectedImageModal.designName}
                    className="max-h-[65vh] w-auto object-contain rounded"
                  />
                ) : (
                  <div className="py-20 text-center text-muted-foreground">
                    <ImageIcon className="mx-auto size-12 opacity-30 mb-2" />
                    <p className="text-sm">No swatch image available for this design.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">
                  DN: {selectedImageModal.dn || "—"} | Reed: {selectedImageModal.reed || "—"} |
                  Pick: {selectedImageModal.pick || "—"} | Cards: {selectedImageModal.cards || "—"}
                </span>
                <span className="font-semibold text-foreground">
                  {selectedImageModal.beamColours.length} Beam Colours
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
