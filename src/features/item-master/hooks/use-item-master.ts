import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { getItemMasterService } from "@/features/item-master/services";
import type { ItemInput } from "@/features/item-master/types/item-master";

const KEY = ["item-master-v1"] as const;

export const itemMasterKeys = {
  all: KEY,
  lookups: [...KEY, "lookups"] as const,
  list: [...KEY, "list"] as const,
  item: (id: string) => [...KEY, "item", id] as const,
};

export function useItemMasterMode() {
  return getItemMasterService().mode;
}

/** Create / clone / edit are allowed only with the masters permission AND in prototype mode. */
export function useItemMasterAccess() {
  const { can } = usePermissions();
  const mode = useItemMasterMode();
  const demo = mode === "demo";
  return {
    mode,
    canCreate: demo && can("masters.generic:create"),
    canUpdate: demo && can("masters.generic:update"),
  };
}

export function useItemLookups() {
  return useQuery({
    queryKey: itemMasterKeys.lookups,
    queryFn: () => getItemMasterService().getLookups(),
    staleTime: Infinity,
  });
}

export function useItemList() {
  return useQuery({
    queryKey: itemMasterKeys.list,
    queryFn: () => getItemMasterService().listItems(),
  });
}

export function useItem(id: string | null) {
  return useQuery({
    queryKey: itemMasterKeys.item(id ?? ""),
    queryFn: () => getItemMasterService().getItem(id ?? ""),
    enabled: !!id,
  });
}

type SaveArgs = { input: ItemInput; id?: string | undefined; asDraft: boolean };

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id, asDraft }: SaveArgs) => {
      const svc = getItemMasterService();
      return asDraft ? svc.saveDraft(input, id) : svc.save(input, id);
    },
    onSuccess: (record) => {
      qc.setQueryData(itemMasterKeys.item(record.id), record);
      void qc.invalidateQueries({ queryKey: itemMasterKeys.list });
    },
  });
}

export function useDeleteItemDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getItemMasterService().deleteDraft(id),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: itemMasterKeys.item(id) });
      void qc.invalidateQueries({ queryKey: itemMasterKeys.list });
    },
  });
}
