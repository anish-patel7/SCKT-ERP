import { useRef } from "react";
import { ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import type { ItemAttachment, ItemImage } from "@/features/item-master/types/item-master";
import { newRowId } from "@/features/item-master/utils/item-model";
import { formatNumber } from "@/lib/erp/formatting";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, "rate")} KB`;
  return `${formatNumber(bytes / (1024 * 1024), "rate")} MB`;
}

/**
 * Item image preview. The file stays in browser memory (object URL) only.
 * ITEM IMAGE STORAGE → BACKEND PHASE.
 */
export function ItemImageDialog({
  open,
  onOpenChange,
  image,
  onChange,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ItemImage | null;
  onChange: (image: ItemImage | null) => void;
  readOnly: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is larger than 5 MB");
      return;
    }
    onChange({ name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Item Image</DialogTitle>
          <DialogDescription>
            Preview only — the image is kept in this browser tab and is not uploaded. Image storage
            is part of the backend phase.
          </DialogDescription>
        </DialogHeader>
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {image ? (
            <img
              src={image.url}
              alt={`Item image: ${image.name}`}
              className="size-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="size-8" />
              No image
            </div>
          )}
        </div>
        {image && (
          <p className="truncate text-xs text-muted-foreground">
            {image.name} · {fileSize(image.size)}
          </p>
        )}
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {image && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => onChange(null)}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="gap-1"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" /> {image ? "Replace" : "Choose Image"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Attachment metadata only; files are not uploaded in the prototype. */
export function ItemAttachmentsDialog({
  open,
  onOpenChange,
  attachments,
  onChange,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: ItemAttachment[];
  onChange: (attachments: ItemAttachment[]) => void;
  readOnly: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const now = new Date().toISOString();
    onChange([
      ...attachments,
      ...Array.from(files).map((f): ItemAttachment => ({
        id: newRowId("att"),
        name: f.name,
        type: f.type || "unknown",
        size: f.size,
        addedBy: user?.email ?? "Current user",
        addedAt: now,
      })),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attachments</DialogTitle>
          <DialogDescription>
            Demo only — file details are listed but files are not uploaded. Secure file storage is
            part of the backend phase.
          </DialogDescription>
        </DialogHeader>
        {attachments.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No attachments
          </p>
        ) : (
          <div className="relative max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="px-2 py-1.5">
                    File Name
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    Type
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right">
                    Size
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    Added By
                  </th>
                  {!readOnly && (
                    <th scope="col" className="w-10 px-2 py-1.5">
                      <span className="sr-only">Remove</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {attachments.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="max-w-48 truncate px-2 py-1.5">{a.name}</td>
                    <td className="max-w-32 truncate px-2 py-1.5 text-muted-foreground">
                      {a.type}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">
                      {fileSize(a.size)}
                    </td>
                    <td className="max-w-40 truncate px-2 py-1.5">{a.addedBy}</td>
                    {!readOnly && (
                      <td className="px-1 py-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          aria-label={`Remove attachment ${a.name}`}
                          onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!readOnly && (
          <div className="flex justify-end">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              className="gap-1"
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="size-3.5" /> Add Attachment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
