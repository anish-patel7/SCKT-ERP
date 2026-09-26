import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useIssueJobCards } from "@/hooks/useProduction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const IssuanceSchema = z.object({
  card_count: z.coerce.number().int().positive("Count must be at least 1"),
});

interface JobCardIssuanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order_id: string;
  order_qty: number;
}

export function JobCardIssuanceDialog({
  open,
  onOpenChange,
  order_id,
  order_qty,
}: JobCardIssuanceDialogProps) {
  const form = useForm({
    resolver: zodResolver(IssuanceSchema),
    defaultValues: {
      card_count: 1,
    },
  });

  const { mutate, isPending } = useIssueJobCards();

  const cardCount = form.watch("card_count");
  const qtyPerCard = cardCount > 0 ? (order_qty / cardCount).toFixed(2) : "0.00";

  const onSubmit = (data: any) => {
    mutate(
      { order_id, count: data.card_count },
      {
        onSuccess: () => {
          toast.success(`${data.card_count} job cards issued successfully`);
          form.reset();
          onOpenChange(false);
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to issue job cards");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Job Cards</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Job cards will be generated atomically. All cards or none will be created.
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2 p-3 bg-muted rounded">
                <div className="text-sm">
                  <span className="font-medium">Order Quantity:</span> {order_qty} metres
                </div>
              </div>

              <FormField
                control={form.control}
                name="card_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Job Cards</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2 p-3 bg-primary/5 rounded">
                <div className="text-sm">
                  <span className="font-medium">Qty per Card:</span> {qtyPerCard} metres
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Cards will be numbered automatically (e.g., PO-2601-JC01, PO-2601-JC02)</p>
                <p>Each card will have equal quantity distribution</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Issuing..." : "Issue Cards"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
