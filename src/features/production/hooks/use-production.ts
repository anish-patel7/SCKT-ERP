import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProductionService, resetProductionDemo } from "@/features/production/services";
import type { StockQuery } from "@/features/production/services/production-service";
import type {
  DateRange,
  InputOf,
  JobCardAdjustmentInput,
  ProductionKind,
} from "@/features/production/types/production";

/** Every production query shares this prefix: posting one document can change many registers. */
const ROOT = ["production-v1"] as const;

const service = () => getProductionService();

function useInvalidateProduction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT });
}

function savedMessage(number: string): string {
  return service().mode === "demo"
    ? `${number} saved in frontend demo mode (not in the database)`
    : `${number} saved`;
}

export function useProductionMode() {
  return service().mode;
}

export function useProductionMasters() {
  return useQuery({
    queryKey: [...ROOT, "masters"],
    queryFn: () => service().getMasters(),
    staleTime: Infinity,
  });
}

export function useProductionList<K extends ProductionKind>(kind: K, range?: DateRange) {
  return useQuery({
    queryKey: [...ROOT, "list", kind, range ?? null],
    queryFn: () => service().list(kind, range),
  });
}

export function useProductionDrafts<K extends ProductionKind>(kind: K) {
  return useQuery({
    queryKey: [...ROOT, "drafts", kind],
    queryFn: () => service().listDrafts(kind),
  });
}

export function useAvailableQty(query: StockQuery | null) {
  return useQuery({
    queryKey: [...ROOT, "available", query],
    queryFn: () => service().getAvailableQty(query!),
    enabled: query !== null,
  });
}

export function useDailyProductionLines(range: DateRange) {
  return useQuery({
    queryKey: [...ROOT, "daily-lines", range],
    queryFn: () => service().listDailyProductionLines(range),
  });
}

export function useJobOrderTrace(jobOrderId: string | null) {
  return useQuery({
    queryKey: [...ROOT, "trace", jobOrderId],
    queryFn: () => service().traceJobOrder(jobOrderId!),
    enabled: !!jobOrderId,
  });
}

/** Post a document. Validation errors are left to the form to show next to fields. */
export function useCreateProductionDocument<K extends ProductionKind>(kind: K) {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: (input: InputOf<K>) => service().create(kind, input),
    onSuccess: async (doc) => {
      await invalidate();
      toast.success(savedMessage(doc.number));
    },
  });
}

export function useSaveProductionDraft<K extends ProductionKind>(kind: K) {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: ({ input, draftId }: { input: InputOf<K>; draftId?: string }) =>
      service().saveDraft(kind, input, draftId),
    onSuccess: async () => {
      await invalidate();
      toast.success("Draft saved (frontend demo mode)");
    },
  });
}

export function usePostProductionDraft<K extends ProductionKind>(kind: K) {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: (draftId: string) => service().postDraft(kind, draftId),
    onSuccess: async (doc) => {
      await invalidate();
      toast.success(savedMessage(doc.number));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not post draft"),
  });
}

export function useDeleteProductionDraft(kind: ProductionKind) {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: (draftId: string) => service().deleteDraft(kind, draftId),
    onSuccess: async () => {
      await invalidate();
      toast.success("Draft deleted");
    },
  });
}

export function useAdjustJobCard() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: (input: JobCardAdjustmentInput) => service().adjustJobCard(input),
    onSuccess: async () => {
      await invalidate();
      toast.success("Demo adjustment recorded (frontend demo mode)");
    },
  });
}

export function useResetProductionDemo() {
  const invalidate = useInvalidateProduction();
  return () => {
    resetProductionDemo();
    void invalidate();
    toast.success("Demo data restored");
  };
}
