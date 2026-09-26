# SCKT ERP — Fresh Supabase setup

Deployment database authority: `supabase/bootstrap/SCKT_FRESH_PROJECT.sql` only.
The 77 historical migrations are reference material; do not replay them.
Run the bootstrap only on a completely new project. Stop on the first SQL error.
Do not deploy before independent review passes.

## 1. Create a new Supabase project

Create the project in the Supabase dashboard and keep its database password private.
Do not manually create application tables first.

## 2. Run the one bootstrap

Paste the entire `supabase/bootstrap/SCKT_FRESH_PROJECT.sql` into SQL Editor and
run it once. Verify successful transaction completion before proceeding.
Do not run historical migrations or reset an existing database.

## 3. Create the initial Auth user

In Authentication → Users, create the administrator with your chosen email and
password. Verify the signup trigger created its profile.

## 4. Assign the canonical Admin role

Replace the email below with the user created in step 3. Run as the database
administrator. Authorization is role-based; there is no automatic email bypass.

```sql
INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary)
SELECT u.id, r.id, true
FROM auth.users u CROSS JOIN public.role_definitions r
WHERE u.email = 'admin@example.com' AND r.role_code = 'admin'
ON CONFLICT (user_id, role_id) DO UPDATE
SET is_active = true, is_primary = true;

SELECT u.email, r.role_code, m.is_active
FROM public.user_roles_mapping m
JOIN auth.users u ON u.id = m.user_id
JOIN public.role_definitions r ON r.id = m.role_id
WHERE u.email = 'admin@example.com';
```

## 5. Configure Vercel environment variables

The browser client in `src/integrations/supabase/client.ts` reads exactly:

```dotenv
VITE_SUPABASE_URL=https://<new-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<new-project-publishable-key>
```

Use the new project's publishable key (or its legacy public anon key as the value
of the same publishable-key variable). These values enter the browser build.
Set them for the desired Vercel environments before building.

Server-only configuration is separate:

| Variable | Source usage |
| --- | --- |
| `SUPABASE_URL` | Server client URL; shared client can fall back to its Vite counterpart. |
| `SUPABASE_PUBLISHABLE_KEY` | Server public client; shared client can fall back to its Vite counterpart. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional administration helper in `client.server.ts`; no current route imports it. Not required for the current V1 route flow. |

The auth middleware requires the first two server variables if wired into a
handler; current routes do not import it. Configure server URL and publishable
key counterparts for the server runtime. Never prefix a service-role key or
other secret with `VITE_`, put it in browser code, or commit it.

Locally, copy `.env.example` to `.env.local` and enter the new project's values.
Keep `.env.local` out of source control and review ZIPs.

## 6. Deploy after independent approval

This package is for review first. After approval, install dependencies, run
`npm run typecheck` and `npm run build`, then deploy on Vercel. Rebuild after
changing Vite environment variables. Configure Supabase Auth Site URL and allowed
redirect URLs for the deployed domain.

## 7. Log in

Use the Auth user from step 3. For local development run `npm run dev` and open
`http://localhost:5173` (or the port printed by Vite).

## 8. Verify modules and permissions

Check Masters, Designs, Cost Sheets, Inventory, Reservations, Production, Quality,
Sales, and Access Groups. Test restricted users as well as Admin. Access Group
permission changes must take effect in database RLS, not only navigation guards.

Cost Sheet header deletion is disabled for all browser roles, including Admin:
V1 exposes no delete action. Draft line/charge editing retains existing policies.
The unused service delete method is unchanged.

The inventory availability view uses `security_invoker` so underlying RLS applies.
Anonymous users have no business table/view privileges. Authenticated RPC grants
are explicitly listed at the end of the bootstrap, separately from RLS helpers.
Actor parameters remain in signatures for compatibility; authoritative mutation
actors come from `auth.uid()`.

## Local verification scope

`scripts/bootstrap-security` contains focused checks and evidence. The disposable
PostgreSQL harness supplies platform roles and minimal `auth.users`/`auth.uid()`
compatibility. It applies only the bootstrap. It does not emulate GoTrue or
PostgREST: SQL role tests verify database enforcement, while live HTTP integration
is a separate check. Read test results before treating the package as ready.
