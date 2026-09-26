import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  executeFullMigration,
  migrateCostSheets,
  migrateYarnMasters,
  migrateInventory,
  type MigrationProgress,
  type MigrationSummary,
} from "@/services/migration";
import {
  type CostSheetFull,
  type YarnMaster,
  type InventoryData,
} from "@/lib/migration-validators";
import { getLocalCostSheets } from "@/lib/cost-sheet-store";
import { getLocalYarnMaterials } from "@/lib/material-store";
import { getInventory } from "@/lib/inventory-store";

/**
 * useLocalStorageData: Load all localStorage data
 */
export function useLocalStorageData() {
  return useQuery({
    queryKey: ["localStorage", "all-data"],
    queryFn: async () => {
      if (typeof window === "undefined") {
        return {
          costSheets: [],
          yarnMasters: [],
          inventory: { yarn: [], beams: [], fabricRolls: [], movements: [] },
        };
      }

      return {
        costSheets: getLocalCostSheets(),
        yarnMasters: getLocalYarnMaterials(),
        inventory: getInventory(),
      };
    },
    staleTime: Infinity, // localStorage doesn't change in background
  });
}

/**
 * useMigrationProgress: Track migration progress with state
 */
export function useMigrationProgress() {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);

  const updateProgress = useCallback((newProgress: MigrationProgress) => {
    setProgress(newProgress);
  }, []);

  return { progress, updateProgress };
}

/**
 * useMigrateCostSheets: Migrate cost sheets
 */
export function useMigrateCostSheets() {
  const { progress, updateProgress } = useMigrationProgress();

  const mutation = useMutation({
    mutationFn: async (sheets: CostSheetFull[]) => {
      return migrateCostSheets(sheets, updateProgress);
    },
  });

  return {
    migrate: mutation.mutate,
    migrateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    progress,
  };
}

/**
 * useMigrateYarnMasters: Migrate yarn materials
 */
export function useMigrateYarnMasters() {
  const { progress, updateProgress } = useMigrationProgress();

  const mutation = useMutation({
    mutationFn: async (materials: YarnMaster[]) => {
      return migrateYarnMasters(materials, updateProgress);
    },
  });

  return {
    migrate: mutation.mutate,
    migrateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    progress,
  };
}

/**
 * useMigrateInventory: Migrate inventory items and transactions
 */
export function useMigrateInventory() {
  const { progress, updateProgress } = useMigrationProgress();

  const mutation = useMutation({
    mutationFn: async (inventory: InventoryData) => {
      return migrateInventory(inventory, updateProgress);
    },
  });

  return {
    migrate: mutation.mutate,
    migrateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    progress,
  };
}

/**
 * useFullMigration: Execute complete migration (all three phases)
 */
export function useFullMigration() {
  const { progress, updateProgress } = useMigrationProgress();

  const mutation = useMutation({
    mutationFn: async ({
      costSheets,
      yarnMasters,
      inventory,
    }: {
      costSheets: CostSheetFull[];
      yarnMasters: YarnMaster[];
      inventory: InventoryData;
    }) => {
      return executeFullMigration(costSheets, yarnMasters, inventory, updateProgress);
    },
  });

  return {
    migrate: mutation.mutate,
    migrateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data as MigrationSummary | undefined,
    progress,
  };
}

/**
 * useExportLocalStorage: Export all localStorage data as JSON
 */
export function useExportLocalStorage() {
  return useMutation({
    mutationFn: async () => {
      if (typeof window === "undefined") {
        throw new Error("Export only works in browser");
      }

      const data = {
        costSheets: getLocalCostSheets(),
        yarnMasters: getLocalYarnMaterials(),
        inventory: getInventory(),
        exportedAt: new Date().toISOString(),
      };

      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sckt-localStorage-export-${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return data;
    },
  });
}

/**
 * useMigrationValidator: Just validate localStorage data without importing
 */
export function useMigrationValidator() {
  const { data: storageData, isLoading } = useLocalStorageData();

  return useQuery({
    queryKey: ["migration", "validation", storageData],
    queryFn: async () => {
      if (!storageData) return null;

      const {
        validateCostSheets,
        validateYarnMasters,
        validateInventoryItems,
      } = await import("@/lib/migration-validators");

      return {
        costSheets: validateCostSheets(storageData.costSheets),
        yarnMasters: validateYarnMasters(storageData.yarnMasters),
        inventory: validateInventoryItems(storageData.inventory),
      };
    },
    enabled: !isLoading && !!storageData,
  });
}

// ============================================================================
// STEP 20 PHASE 12B: localStorage → Supabase Migration Hooks
// ============================================================================

/**
 * useLocalStorageMigration: Main hook for PHASE 12B migration
 * Migrates materials and designs from localStorage to Supabase
 */
export function useLocalStorageMigration() {
  const [state, setState] = useState({
    progress: null as any,
    isRunning: false,
    error: null as string | null,
  });

  const { mutateAsync: runMigration, isPending } = useMutation({
    mutationFn: async (onProgress?: (p: any) => void) => {
      const { localStorageMigrationService } = await import(
        "@/services/migration-localstorage"
      );
      return localStorageMigrationService.runFullMigration(onProgress);
    },
    onSuccess: () => {
      setState((prev) => ({ ...prev, isRunning: false }));
    },
    onError: (error: Error) => {
      setState((prev) => ({ ...prev, isRunning: false, error: error.message }));
    },
  });

  const startMigration = useCallback(async () => {
    setState({
      progress: {
        status: "in_progress",
        step: "Starting migration...",
        completedCount: 0,
        totalCount: 0,
        percentage: 0,
      },
      isRunning: true,
      error: null,
    });

    try {
      await runMigration((progress) => {
        setState((prev) => ({ ...prev, progress }));
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Migration failed";
      setState((prev) => ({ ...prev, error: msg }));
    }
  }, [runMigration]);

  return {
    ...state,
    startMigration,
    isLoading: isPending,
  };
}

/**
 * useMigrationStatus: Check if migration has been completed
 */
export function useMigrationCheckStatus() {
  return useQuery({
    queryKey: ["migration", "phase12b-status"],
    queryFn: async () => {
      const { localStorageMigrationService } = await import(
        "@/services/migration-localstorage"
      );
      return localStorageMigrationService.getMigrationStatus();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
