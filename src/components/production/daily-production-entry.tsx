import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DailyProductionSchema } from "@/services/dailyProduction";
import { useRecordDailyProduction, useJobCardDetails } from "@/hooks";
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

interface DailyProductionEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job_card_id?: string;
  loom_id?: string;
}

export function DailyProductionEntry({
  open,
  onOpenChange,
  job_card_id,
  loom_id,
}: DailyProductionEntryProps) {
  const form = useForm({
    resolver: zodResolver(DailyProductionSchema),
    defaultValues: {
      job_card_id,
      loom_id,
      shift: "A",
      entry_date: new Date().toISOString().split("T")[0],
      downtime_min: 0,
    },
  });

  const { data: jobCard } = useJobCardDetails(job_card_id || "");
  const { mutate, isPending } = useRecordDailyProduction();

  const onSubmit = (data: any) => {
    mutate(data, {
      onSuccess: () => {
        toast.success("Production logged successfully");
        form.reset();
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to log production");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Daily Production</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {jobCard && (
                <div>
                  Card: {jobCard.card_no} | Qty: {jobCard.qty_metre}m
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shift"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">Shift A (6AM - 2PM)</SelectItem>
                      <SelectItem value="B">Shift B (2PM - 10PM)</SelectItem>
                      <SelectItem value="C">Shift C (10PM - 6AM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="metre_produced"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metres Produced</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="yarn_kg_used"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yarn Used (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="downtime_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Downtime (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="downtime_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Downtime Reason</FormLabel>
                  <FormControl>
                    <Input placeholder="Maintenance, yarn break, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quality_grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Grade</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">A (Excellent)</SelectItem>
                      <SelectItem value="B">B (Good)</SelectItem>
                      <SelectItem value="C">C (Acceptable)</SelectItem>
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
                    <Textarea placeholder="Notes..." {...field} />
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
                {isPending ? "Recording..." : "Record Production"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
