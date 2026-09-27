import { isFrontendPrototypeEnabled } from "@/lib/frontend-prototype";

/** Production screens follow the shared frontend prototype switch. */
export function isProductionDemoEnabled(): boolean {
  return isFrontendPrototypeEnabled();
}
