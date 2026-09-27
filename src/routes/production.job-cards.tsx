import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibility route: the former "Job Cards" screen is now part of the Rapier Module.
// Its live database register is on the canonical page under "Database records".
export const Route = createFileRoute("/production/job-cards")({
  beforeLoad: () => {
    throw redirect({
      to: "/production/rapier/$",
      params: { _splat: "job-cards/issues" },
      search: { source: "database" },
      replace: true,
    });
  },
});
