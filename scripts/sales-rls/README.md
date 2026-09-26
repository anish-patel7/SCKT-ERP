# Sales Order header RLS review

Current follow-up evidence is in this directory. Results in `bootstrap-security`
and `sales-confirmation` describe the earlier reviews and are retained as history.
Deployment still uses only `supabase/bootstrap/SCKT_FRESH_PROJECT.sql`.

## Bounded change

Removed the two actual legacy header policies `admin_full_access_sales_orders`
and `manager_view_sales_orders`. Their `profiles.primary_role_id` checks prevented
role-mapped Admins and custom Sales roles from reading orders after confirmation.

Final policies use `public.user_has_permission(auth.uid(), ...)`:

| Action | Permission |
| --- | --- |
| SELECT | `sales:read` |
| INSERT | `sales:create` |
| UPDATE, including resulting row | `sales:update` |
| Narrow empty-header rollback DELETE | `sales:create`, plus conditions below |

No RPC, trigger, line-item policy, RBAC helper, table privilege, other module,
application source, dependency version, environment file or historical migration
changed. Static masking compares all SQL outside the Sales header policies;
file hashes verify the frontend, all 77 migrations and configuration remain intact.

## Rollback decision

`salesService.createOrder` inserts a header, then inserts its lines. On a line
failure it deletes that header. The current routed Sales page can insert headers
directly as CONFIRMED without setting `confirmed_at`, so draft-only rollback
would leave those failed creations behind.

The DELETE policy therefore permits only an empty DRAFT or CONFIRMED header with
`confirmed_at IS NULL`, `sales:create`, and matching creator identity. Creator
matches either `auth.uid()::text` or the authenticated JWT email because the
unchanged service writes `user.email`. Identity claims are supplied by Supabase
Auth in production; no caller-defined business parameter supplies those claims.

Rows with lines, a confirmation timestamp, another creator, or another status
are excluded. There is no general Sales delete permission or new permission code.
The SELECT policy remains independently required for the service's returned rows.
Tests cover the existing email actor format, UUID actor format, actual line-insert
failure and cleanup, non-owner denial, populated-order denial, confirmed-order
denial and permission removal.

## Verification

Fresh local PostgreSQL database: `sckt_rls_fixed` at `127.0.0.1:55439`.
The minimal Supabase platform fixture is `scripts/bootstrap-security/platform.sql`.
After that fixture, apply ONLY the bootstrap with `psql -v ON_ERROR_STOP=1`.
Stop if bootstrap execution fails. Never apply historical migrations.

Run once on a fresh database:

```
python scripts/sales-rls/test_rls.py sckt_rls_fixed
python scripts/sales-rls/static_check.py
```

The test executable path is specific to the local PostgreSQL installation and
can be adjusted on another machine. Test data is disposable and is not deployment
seed data. No constraint, RLS policy or trigger is disabled for the tests.

All 73 database checks pass. Admin access is assigned through
`user_roles_mapping`, with an explicit assertion that the profile is not legacy
Admin. Both Admin and a custom read/create/update group create headers and lines
as authenticated users, read them, update the draft, confirm through the RPC and
immediately fetch the header with its lines. The returned row is visible, resolving
the service's previous follow-up "Order not found" failure at the database layer.

Protected customer snapshots, line quantities and commercial prices reject edits
after confirmation. Existing triggers work because the header is now visible.
Removing `sales:update` blocks header/line updates and RPC confirmation while
retaining read access. Removing `sales:create` blocks insertion and rollback.
Users with no Sales permissions see no rows and cannot write or confirm. Anonymous
users receive permission errors. Line-item policies remain unchanged.

These are real database-role tests matching the service's statements; they are
not a claim of browser/PostgREST integration testing. The current routed page
continues its existing direct-create behavior without frontend changes.

The production build passes. Typecheck reports the same 605 existing errors,
with zero changed-file errors; unrelated TypeScript work was explicitly excluded.
No GitHub push, remote Supabase SQL, Vercel configuration or deployment occurred.

Evidence: `baseline.json`, `static-results.json`, `final-policies.json`,
`database-results.json`, build/typecheck logs and archive verification.
