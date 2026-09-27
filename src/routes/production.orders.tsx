import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibility route: the former "Production Orders" screen is now part of the Rapier Module.
// Its live database register is on the canonical page under "Database records".
export const Route = createFileRoute("/production/orders")({
  beforeLoad: () => {
    throw redirect({
      to: "/production/rapier/$",
      params: { _splat: "job-orders" },
      search: { source: "database" },
      replace: true,
    });
  },
});
