# Bootstrap security verification

Only `supabase/bootstrap/SCKT_FRESH_PROJECT.sql` is application database authority.
These tests use a disposable local PostgreSQL 18 instance, loopback port 55439.
`platform.sql` supplies minimal Supabase platform roles, Auth users, `auth.uid()`
and `auth.jwt()`. It is a test fixture, not a migration or deployment script.
No remote project, GoTrue server or PostgREST endpoint is contacted.

## Reproduce

1. Initialize a disposable PostgreSQL cluster; bind it to `127.0.0.1:55439`.
2. Create a clean database named `sckt_final`.
3. Apply `platform.sql` with `psql -v ON_ERROR_STOP=1`.
4. Run `python scripts/bootstrap-security/static_check.py`.
5. Apply only `supabase/bootstrap/SCKT_FRESH_PROJECT.sql` with `ON_ERROR_STOP=1`.
   Stop at the first bootstrap SQL error. Never run historical migrations.
6. Run `python scripts/bootstrap-security/database_check.py` once on that database.
7. Run `python scripts/bootstrap-security/additional_check.py`.
8. Run `node scripts/bootstrap-security/contract_check.mjs` after installing project dependencies.

The database scripts have an explicit local PostgreSQL executable path; adapt
that path for other machines. Test users and data are disposable and must never
be loaded into a deployment. Repeat the tests using a new clean database.

## Evidence and limits

- `baseline.json`: original SQL hash and immutable application/migration hashes.
  This extracted folder has no Git metadata; branch/commit are unavailable.
- `static-results.json`: delimiters, policy duplication, permission references,
  grants, fixed search paths, actor assignments, source freeze and env naming.
- `rpc-inventory.json`: functions found in services and their classification.
  Reachability uses current route imports. For imported service modules the
  allowlist conservatively preserves their defined RPC methods; it is not a
  tree-shaken production-bundle call graph. The unused customer credit mutation
  and deferred bulk/dispatch/fulfillment/invoicing modules are not granted.
- `database-results.json`: custom-role permission add/remove, anonymous/restricted
  denial, Admin master create, simultaneous reservation attempts, Quality actor
  spoofing and grading, default function ACLs, and actual object/ACL counts.
- `additional-results.json`: missing-user rejection for every granted mutation,
  zero anonymous/PUBLIC function access, fixed definer search paths, table ACLs,
  and a valid Sales confirmation smoke test.
- `contract-results.json`: 312 literal column references checked; no missing
  references found. Thirty-one nested relation selections, dynamic payloads,
  and builder variables require additional review. This does not establish
  exhaustive column compatibility.

`_user_id` in permission/RBAC read helpers is the permission subject, not an
authoritative mutation actor. Admin user-management screens may inspect another
subject. Mutation actor parameters remain accepted for signature compatibility
but are ignored in favor of the authenticated identity.

The final SQL has 55 application functions and 10 extension functions. Fourteen
client RPCs and three policy helpers receive explicit authenticated execution.
Trigger-only and other internal helpers have no authenticated execution. The
inventory view is owned by postgres, uses `security_invoker=true`, exposes
sensitive inventory data only through authenticated SELECT plus underlying RLS,
and has no anonymous privileges.

The valid Sales confirmation test currently fails on an ambiguous `status`
reference in its pre-existing business query. This is recorded as a blocker,
not a passing test. Typecheck and lint also fail in unchanged application source.
The package is partial and must not be deployed based on these results.

SQL role tests establish database enforcement; HTTP REST/auth integration is not
tested by this harness. No frontend behavior, historical migrations, package
versions or generated database type signatures were changed.
