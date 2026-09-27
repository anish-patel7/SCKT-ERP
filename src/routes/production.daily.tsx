import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibility route: the former "Daily Production" screen is now part of the Rapier Module.
// Its live database register is on the canonical page under "Database records".
export const Route = createFileRoute("/production/daily")({
  beforeLoad: () => {
    throw redirect({
      to: "/production/rapier/$",
      params: { _splat: "job-cards/daily-production" },
      search: { source: "database" },
      replace: true,
    });
  },
});
