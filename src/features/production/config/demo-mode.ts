/**
 * Frontend demo mode for the Production (Rapier / Warping) screens.
 *
 * On in development (`vite dev`, including preview sandboxes). Off in production builds
 * unless the deployment sets VITE_PRODUCTION_DEMO=true, so a public deployment never
 * presents in-memory demo documents as real production data.
 */
export function isProductionDemoEnabled(): boolean {
  const env = import.meta.env as Record<string, unknown>;
  return env["DEV"] === true || env["VITE_PRODUCTION_DEMO"] === "true";
}
