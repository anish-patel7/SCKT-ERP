import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateProductionOrder } from "@/hooks/useProduction";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OrderSchema = z.object({
  order_no: z.string().min(1, "Order number required"),
  design_no: z.string().min(1, "Design number required"),
  party_id: z.string().uuid("Party required"),
  quality_name: z.string().min(1, "Quality name required"),
  qty_metre: z.coerce.number().positive("Quantity must be positive"),
  target_delivery_date: z.string().refine((d) => !isNaN(Date.parse(d)), "Valid date required"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  cost_sheet_id: z.string().uuid().nullable().optional(),
  remarks: z.string().optional(),
});

type OrderFormData = z.infer<typeof OrderSchema>;

interface ProductionOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parties?: any[];
  costSheets?: any[];
}

export function ProductionOrderForm({
  open,
  onOpenChange,
  parties = [],
  costSheets = [],
}: ProductionOrderFormProps) {
  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderSchema),
    defaultValues: {
      priority: "normal",
    },
  });

  const { mutate, isPending } = useCreateProductionOrder();

  const onSubmit = (data: OrderFormData) => {
    mutate(data, {
      onSuccess: () => {
        toast.success("Production order created successfully");
        form.reset();
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create order");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="order_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Number</FormLabel>
                  <FormControl>
                    <Input placeholder="PO-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="design_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Design Number</FormLabel>
                  <FormControl>
                    <Input placeholder="D-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="party_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Party</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select party" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.party_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quality_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Kashmiri Kota" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qty_metre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity (metres)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Delivery Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cost_sheet_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Sheet (Optional)</FormLabel>
                  <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || null)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cost sheet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {costSheets.map((cs) => (
                        <SelectItem key={cs.id} value={cs.id}>
                          {cs.code_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
