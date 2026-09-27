import { isProductionDemoEnabled } from "@/features/production/config/demo-mode";
import { WarpingDemoService } from "@/features/production/warping/warping-demo-service";
import {
  WarpingUnavailableError,
  type WarpingService,
} from "@/features/production/warping/warping-types";

/** Prototype disabled and no backend yet: empty registers, no writes. */
class UnavailableWarpingService implements WarpingService {
  readonly mode = "unavailable" as const;
  async listBeams() {
    return [];
  }
  async listMovements() {
    return [];
  }
  async produceBeam(): Promise<never> {
    throw new WarpingUnavailableError();
  }
  async loadBeam(): Promise<never> {
    throw new WarpingUnavailableError();
  }
  async unloadBeam(): Promise<never> {
    throw new WarpingUnavailableError();
  }
  async moveBeam(): Promise<never> {
    throw new WarpingUnavailableError();
  }
}

let instance: WarpingService | null = null;

/** Swap for a Supabase implementation in the backend phase; the screens do not change. */
export function getWarpingService(): WarpingService {
  instance ??= isProductionDemoEnabled()
    ? new WarpingDemoService()
    : new UnavailableWarpingService();
  return instance;
}

/** Restore the beam fixtures (demo mode only); called by the Production demo reset. */
export function resetWarpingDemo(): void {
  if (instance instanceof WarpingDemoService) instance = new WarpingDemoService();
}
