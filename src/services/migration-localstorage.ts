import { supabase } from "@/integrations/supabase/client";
import { materialsService } from "./materials";
import { designsService } from "./designs";
import type { Material } from "./materials";
import type { DesignWithDetails } from "@/types/design";

/**
 * STEP 20 PHASE 12B: localStorage → Supabase Migration Service
 * Handles one-time migration of business data from browser localStorage to PostgreSQL
 * Tracks completion per user to avoid re-running
 */

export type MigrationStatus = "pending" | "in_progress" | "completed" | "failed";

export interface MigrationProgress {
  status: MigrationStatus;
  step: string;
  completedCount: number;
  totalCount: number;
  percentage: number;
  lastError?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

// ============================================================================
// MIGRATION SERVICE
// ============================================================================

export const localStorageMigrationService = {
  /**
   * Check if migration has already been completed for current user
   */
  async isMigrationCompleted(): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;

    try {
      const { data } = await supabase
        .from("user_preferences")
        .select("custom_settings")
        .eq("user_id", session.user.id)
        .single();

      if (data?.custom_settings && typeof data.custom_settings === "object") {
        return (data.custom_settings as any).migration_completed === true;
      }
    } catch {
      // If no preferences exist yet, migration hasn't run
    }

    return false;
  },

  /**
   * Mark migration as completed for current user
   */
  async markMigrationCompleted(): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Not authenticated");

    try {
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("custom_settings")
        .eq("user_id", session.user.id)
        .single();

      const customSettings = (existing?.custom_settings as any) || {};
      customSettings.migration_completed = true;
      customSettings.migration_completed_at = new Date().toISOString();

      await supabase
        .from("user_preferences")
        .update({ custom_settings: customSettings })
        .eq("user_id", session.user.id);
    } catch (err) {
      console.warn("Failed to mark migration completed:", err);
      // Don't fail migration if we can't set the marker
    }
  },

  /**
   * Migrate materials from localStorage to Supabase
   */
  async migrateMaterials(
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<number> {
    try {
      const storedJson = localStorage.getItem("sckt_materials_v1");
      if (!storedJson) {
        onProgress?.({
          status: "completed",
          step: "Materials: no local data",
          completedCount: 0,
          totalCount: 0,
          percentage: 100,
        });
        return 0;
      }

      const materials = JSON.parse(storedJson) as Material[];

      onProgress?.({
        status: "in_progress",
        step: `Migrating ${materials.length} materials...`,
        completedCount: 0,
        totalCount: materials.length,
        percentage: 0,
      });

      let successCount = 0;
      for (let i = 0; i < materials.length; i++) {
        try {
          // Check if material code already exists
          const existing = await materialsService.getMaterialByCode(
            materials[i].code,
          );
          if (!existing) {
            await materialsService.createMaterial({
              code: materials[i].code,
              name: materials[i].name,
              details: materials[i].details || {},
              is_active: materials[i].is_active ?? true,
            });
            successCount++;
          }
        } catch (itemErr) {
          console.error(
            `Failed to migrate material ${materials[i].code}:`,
            itemErr,
          );
        }

        const pct = Math.round(((i + 1) / materials.length) * 100);
        onProgress?.({
          status: "in_progress",
          step: `Migrating materials (${i + 1}/${materials.length})...`,
          completedCount: i + 1,
          totalCount: materials.length,
          percentage: pct,
        });
      }

      onProgress?.({
        status: "completed",
        step: `Materials: ${successCount}/${materials.length} migrated`,
        completedCount: successCount,
        totalCount: materials.length,
        percentage: 100,
      });

      return successCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.({
        status: "failed",
        step: "Materials migration failed",
        completedCount: 0,
        totalCount: 0,
        percentage: 0,
        lastError: msg,
      });
      throw new MigrationError(`Materials: ${msg}`);
    }
  },

  /**
   * Migrate designs from localStorage to Supabase
   */
  async migrateDesigns(
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<number> {
    try {
      const storedJson = localStorage.getItem("sckt_designs_v1");
      if (!storedJson) {
        onProgress?.({
          status: "completed",
          step: "Designs: no local data",
          completedCount: 0,
          totalCount: 0,
          percentage: 100,
        });
        return 0;
      }

      const designs = JSON.parse(storedJson) as DesignWithDetails[];

      onProgress?.({
        status: "in_progress",
        step: `Migrating ${designs.length} designs...`,
        completedCount: 0,
        totalCount: designs.length,
        percentage: 0,
      });

      let successCount = 0;
      for (let i = 0; i < designs.length; i++) {
        try {
          // Check if design number already exists
          const existing = await designsService.getDesignByNumber(
            designs[i].designNumber,
          );
          if (!existing) {
            await designsService.createDesign({
              designNumber: designs[i].designNumber,
              designName: designs[i].designName,
              dn: designs[i].dn,
              dnCode: designs[i].dnCode,
              reed: designs[i].reed,
              pick: designs[i].pick,
              patti: designs[i].patti,
              totalDC: designs[i].totalDC,
              totalCut: designs[i].totalCut,
              work: designs[i].work,
              blueApt: designs[i].blueApt,
              description: designs[i].description,
              remarks: designs[i].remarks,
              image: designs[i].image,
            });
            successCount++;
          }
        } catch (itemErr) {
          console.error(
            `Failed to migrate design ${designs[i].designNumber}:`,
            itemErr,
          );
        }

        const pct = Math.round(((i + 1) / designs.length) * 100);
        onProgress?.({
          status: "in_progress",
          step: `Migrating designs (${i + 1}/${designs.length})...`,
          completedCount: i + 1,
          totalCount: designs.length,
          percentage: pct,
        });
      }

      onProgress?.({
        status: "completed",
        step: `Designs: ${successCount}/${designs.length} migrated`,
        completedCount: successCount,
        totalCount: designs.length,
        percentage: 100,
      });

      return successCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.({
        status: "failed",
        step: "Designs migration failed",
        completedCount: 0,
        totalCount: 0,
        percentage: 0,
        lastError: msg,
      });
      throw new MigrationError(`Designs: ${msg}`);
    }
  },

  /**
   * Run complete migration (materials + designs)
   * This is the main entry point
   */
  async runFullMigration(
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<{
    materialsCount: number;
    designsCount: number;
    success: boolean;
  }> {
    try {
      onProgress?.({
        status: "in_progress",
        step: "Checking migration status...",
        completedCount: 0,
        totalCount: 0,
        percentage: 0,
      });

      // Check if already migrated
      const completed = await this.isMigrationCompleted();
      if (completed) {
        onProgress?.({
          status: "completed",
          step: "Migration already completed",
          completedCount: 0,
          totalCount: 0,
          percentage: 100,
        });
        return { materialsCount: 0, designsCount: 0, success: true };
      }

      // Migrate materials
      const materialsCount = await this.migrateMaterials(onProgress);

      // Migrate designs
      const designsCount = await this.migrateDesigns(onProgress);

      // Mark as completed
      await this.markMigrationCompleted();

      onProgress?.({
        status: "completed",
        step: `Migration complete: ${materialsCount} materials, ${designsCount} designs`,
        completedCount: materialsCount + designsCount,
        totalCount: materialsCount + designsCount,
        percentage: 100,
      });

      return { materialsCount, designsCount, success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.({
        status: "failed",
        step: "Migration failed",
        completedCount: 0,
        totalCount: 0,
        percentage: 0,
        lastError: msg,
      });
      return { materialsCount: 0, designsCount: 0, success: false };
    }
  },

  /**
   * Get status info for display (how much data needs migrating)
   */
  async getMigrationStatus(): Promise<{
    completed: boolean;
    localMaterialsCount: number;
    localDesignsCount: number;
  }> {
    const completed = await this.isMigrationCompleted();

    let localMaterialsCount = 0;
    let localDesignsCount = 0;

    try {
      const matsJson = localStorage.getItem("sckt_materials_v1");
      if (matsJson) {
        localMaterialsCount = JSON.parse(matsJson).length;
      }

      const desgJson = localStorage.getItem("sckt_designs_v1");
      if (desgJson) {
        localDesignsCount = JSON.parse(desgJson).length;
      }
    } catch {
      // Ignore parse errors
    }

    return { completed, localMaterialsCount, localDesignsCount };
  },
};
