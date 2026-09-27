/**
 * Frontend prototype mode: screens whose backend is not designed yet (Production, Item
 * Master) run on in-memory demo adapters.
 *
 * On in development (`vite dev`, including preview sandboxes). Off in production builds
 * unless the deployment sets VITE_PRODUCTION_DEMO=true (or VITE_FRONTEND_PROTOTYPE=true),
 * so a public deployment never presents in-memory demo records as real data.
 */
export function isFrontendPrototypeEnabled(): boolean {
  const env = import.meta.env as Record<string, unknown>;
  return (
    env["DEV"] === true ||
    env["VITE_PRODUCTION_DEMO"] === "true" ||
    env["VITE_FRONTEND_PROTOTYPE"] === "true"
  );
}
