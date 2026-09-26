# Sales confirmation repair — current review evidence

This directory records the Sales-only follow-up to the prior bootstrap review.
Older results in `scripts/bootstrap-security` are historical evidence from that
review. The only deployment SQL remains `supabase/bootstrap/SCKT_FRESH_PROJECT.sql`.

## Scope and source contract

Only `confirm_sales_order`, `confirm_sales_order_with_reservation`, and the latter's
authenticated grant changed in the bootstrap. Static masking/hashes verify all
other SQL is unchanged. Application source, all 77 historical migrations, generated
types, package files, environment template and deployment guide are unchanged.

The exact implemented RPC call chain is:

`src/components/sales/order-list.tsx` → `useConfirmOrder()` in
`src/hooks/useSales.ts` → `salesService.confirmOrder(orderId)` →
`supabase.rpc('confirm_sales_order', { p_order_id: orderId,
p_approved_by: approvedBy || user?.email || 'system' })`.

The service checks the RPC error, then calls `getOrderById(orderId)` and returns
the header with `items` populated from `sales_order_items`. The hook invalidates
`orders` and updates the `order` cache using the returned ID. The RPC signature
and result columns are unchanged: `order_id`, `status`, `customer_name_snapshot`,
`broker_name_snapshot`, `confirmed_at`, `line_count`.

The current routed `src/routes/sales.orders.tsx` does **not** call that hook:
its `handleConfirmOrder` calls `useCreateOrder` with `status: 'CONFIRMED'`.
The separate `OrderList` component is exported but no current route use was found.
This differs from the request's assumed routed call chain. No UI wiring changed.

`confirmSalesOrderWithReservation` is only a service method definition: no hook,
component or route invokes it. Its SQL RPC is now deprecated, authenticated
execution is revoked, and its retained signature raises `0A000` without writing.
No reservation function or policy changed.

## Final schema and commercial snapshots

`schema-contract.json` records actual final database columns for the five requested
tables. The relationship is `sales_orders.customer_id → customers.id →
customers.party_id → parties.id`; the customer snapshot uses `parties.party_name`.
There is no `customers.customer_name`, `parties.name` or `parties.broker_party_id`.

The line FK is `sales_order_items.order_id`, not `sales_order_id`.
The canonical quantities are `qty_metre`, `qty_reserved`, `qty_dispatched`; none
is changed by confirmation. No inventory or reservation rows are created.

There is no header `confirmed_by` field. Existing actor fields are
`sales_orders.updated_by` and `sales_order_items.approved_by`/`updated_by`, set to
`auth.uid()`. The caller's `p_approved_by` is ignored. `confirmed_at` and line
`approved_at` share the confirmation timestamp.

Broker source is the draft order's existing `broker_name_snapshot`, entered by
the Sales form. It is retained unchanged, as are billing and shipping addresses,
tax amounts, totals and other existing header fields. No broker relation, payment
terms snapshot or salesperson field is invented.

Line snapshots use `designs.design_number`, `designs.design_name`,
`cost_sheets.sheet_no` and `cost_sheets.sale_rate`. Optional missing design/cost
links preserve the line's manual `design_no` and agreed `rate_per_metre` fallback.
Lines are locked, validated and snapshotted while the parent is DRAFT, before
changing it to CONFIRMED, to respect the existing immutability trigger.

## Tests and reproduction

Use a disposable local PostgreSQL database with the Supabase compatibility fixture
`scripts/bootstrap-security/platform.sql`, then apply **only** the bootstrap using
`psql -v ON_ERROR_STOP=1`. Stop on the first bootstrap error; do not run migrations.

Run `python scripts/sales-confirmation/test_sales.py <fresh-database-name>` against
the local instance at `127.0.0.1:55439`. The default database is `sckt_sales_fixed`;
the final recorded run used `sckt_sales_fixed_2`. The executable path in tests is
local and may need adjustment on another machine. Constraints and triggers remain
enabled throughout. Each repeat requires a new clean database.

Run `python scripts/sales-confirmation/static_check.py` for scope and stale-column
checks. `repair.py` records the bounded transformation; it is not a deployment or
migration script and does not run automatically.

The final run has 31 passing focused RPC checks: canonical Admin and Sales-only
role confirmation; caller spoof rejection; snapshots and quantities; no reservation
side effects; repeated/invalid-status/empty-order rejection; invalid customer and
commercial data rejection; ACLs; and deprecated-RPC denial. The first diagnostic
run is retained separately and is not reported as passing.

Build passes. Typecheck still reports 605 existing errors, with zero changed-file
errors. No frontend files were changed to fix them.

## Independent defect recorded, not repaired

After RPC confirmation succeeds, existing `sales_orders` RLS checks
`profiles.primary_role_id` instead of canonical role mappings. An Admin assigned
only through `user_roles_mapping` reads zero headers, so the service's follow-up
`getOrderById(...).single()` cannot return the confirmed order.

The same lack of header visibility affects the existing invoker-rights line
immutability trigger: it sees no parent status and allows quantity/pricing changes.
Three diagnostics in `independent-findings.json` reproduce these failures. Those
mutation diagnostics are rolled back. A separate transaction verifies the original
trigger rejects changes when the parent is visible under the legacy profile role;
that fixture change is rolled back too. No RLS policy or trigger was changed.

This is outside the requested RPC-only repair and is recorded per the instruction
not to fix independent Sales defects. End-to-end readiness remains **PARTIAL**.

## UI and deployment

UI confirmation is BLOCKED: the browser had no application tab, no local
Supabase Auth/PostgREST runtime is configured, and the current routed page does
not use the repaired RPC. Direct SQL results are not a browser PASS. The test
fixture simulates Auth identity at the database level only.

No GitHub push, remote SQL, Supabase/Vercel configuration or deployment occurred.
