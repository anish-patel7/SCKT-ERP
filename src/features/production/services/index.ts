import { isProductionDemoEnabled } from "@/features/production/config/demo-mode";
import { ProductionDemoService } from "@/features/production/demo/production-demo-service";
import { resetWarpingDemo } from "@/features/production/warping/warping-service";
import {
  ProductionUnavailableError,
  type ProductionService,
} from "@/features/production/services/production-service";
import type { ProductionMasters } from "@/features/production/types/production";

const EMPTY_MASTERS: ProductionMasters = {
  companies: [],
  units: [],
  warehouses: [],
  parties: [],
  items: [],
  yarns: [],
  machines: [],
  beams: [],
  grades: [],
  salesOrders: [],
  stockStatuses: [],
  conversionTypes: [],
};

/** Used when demo mode is off and no backend exists yet: empty registers, no writes. */
class UnavailableProductionService implements ProductionService {
  readonly mode = "unavailable" as const;
  async getMasters() {
    return EMPTY_MASTERS;
  }
  async list() {
    return [];
  }
  async create(): Promise<never> {
    throw new ProductionUnavailableError();
  }
  async listDrafts() {
    return [];
  }
  async saveDraft(): Promise<never> {
    throw new ProductionUnavailableError();
  }
  async postDraft(): Promise<never> {
    throw new ProductionUnavailableError();
  }
  async deleteDraft(): Promise<never> {
    throw new ProductionUnavailableError();
  }
  async adjustJobCard(): Promise<never> {
    throw new ProductionUnavailableError();
  }
  async getAvailableQty() {
    return 0;
  }
  async listDailyProductionLines() {
    return [];
  }
  async traceJobOrder() {
    return [];
  }
}

let instance: ProductionService | null = null;

/**
 * The Production service used by every screen. Swap this for the Supabase implementation
 * once the backend exists; no screen changes are needed.
 */
export function getProductionService(): ProductionService {
  instance ??= isProductionDemoEnabled()
    ? new ProductionDemoService()
    : new UnavailableProductionService();
  return instance;
}

/** Restore the demo fixtures (demo mode only). */
export function resetProductionDemo(): void {
  const service = getProductionService();
  if (service instanceof ProductionDemoService) service.reset();
  resetWarpingDemo();
}
