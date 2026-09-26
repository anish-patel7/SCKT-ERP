# CLAUDE.md — SCKT Backend Development Guidelines

**Project:** Chehar Krupa Group (SCKT) — Textile ERP System  
**Repository:** anish-patel7/pixel-perfect-render-4435  
**Development Branch:** claude/trusting-ritchie-zg25ff  
**Last Updated:** September 20, 2026

---

## 1. Project Overview

SCKT is a comprehensive textile manufacturing ERP built with:

- **Frontend:** React 19 + TanStack Stack (Router, Query, Start)
- **Database:** PostgreSQL via Supabase
- **Target:** Complete migration from browser-only (localStorage) to server-backed (PostgreSQL) architecture

This document defines the mandatory rules, patterns, and conventions for AI-assisted backend development.

---

## 2. Mandatory Rules (Non-Negotiable)

### 🔴 CRITICAL — Never Violate

1. **Never use localStorage as the source of truth for business data.**
   - localStorage is for: UI preferences (theme, sidebar state), draft recovery only
   - All business data (materials, inventory, costing, production, quality, sales) MUST persist in PostgreSQL
   - localStorage can be a cache layer, but Supabase is always authoritative

2. **Never implement fake/mock authentication in production paths.**
   - No hardcoded user objects (`MOCK_ADMIN_USER`, `MOCK_STANDARD_USER`)
   - No localStorage-based authentication flags (`localStorage.getItem("sckt_authenticated")`)
   - All authentication MUST go through Supabase Auth
   - Mock data allowed only in demo/seed scenarios, clearly marked

3. **Never bypass Supabase RLS for convenience.**
   - Every table with sensitive data MUST have RLS policies
   - Frontend MUST NOT write queries that assume "anyone can access"
   - When RLS is complex, use `SECURITY DEFINER` functions carefully (document why)
   - Test RLS policies: admin should see different data than operator

4. **Never expose service-role keys to the frontend.**
   - Only public/anon keys in `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Service-role keys restricted to backend-only (if backend exists)
   - `.env.local` ignored in git; real secrets never committed

5. **Never put database queries randomly throughout UI components.**
   - All database operations go through `/src/services/` layer
   - Components call hooks, hooks call services, services call Supabase
   - Exceptions: None. This is non-negotiable for maintainability

6. **Never use floating-point numbers for financial data.**
   - Cost/price fields: use Zod with `decimal()` validation or `toFixed(2)`
   - Always round/truncate before displaying currency
   - Store as `DECIMAL(10,2)` in PostgreSQL, never FLOAT

7. **Never create tables without migration files.**
   - All schema changes: `supabase/migrations/[timestamp]_description.sql`
   - Run migrations locally before pushing
   - Never manually edit schema via Dashboard; always use migrations
   - Migrations are source-of-truth; `.sql` files are documentation

8. **Never delete master/historical data without soft-delete.**
   - Parties, yarns, fabrics, processes, machines: mark `is_active = false` or `archived_at = NOW()`
   - Production orders, quality inspections, audit logs: immutable once created
   - Only delete if absolutely certain no historical reference exists
   - Document deletion reason in audit trail

9. **Never assume a user is logged in without validating session.**
   - Always await `supabase.auth.getSession()` before reading profile/roles
   - Session can expire; refresh tokens auto-managed by Supabase client
   - Frontend protection (redirect to /auth) is UX, not security
   - RLS policies enforce actual authorization at database layer

10. **Never commit `.env`, `.env.local`, or any secrets.**
    - `.env.example` shows structure only (no real values)
    - Real Supabase URL/key stored in `.env.local` (gitignored)
    - Lovable/CI environments: secrets injected via platform, not repo

---

## 3. Architecture & Design Patterns

### Data Flow (Mandatory Pattern)

```
React Component
    ↓
Custom Hook (useQuery/useMutation from TanStack Query)
    ↓
Service Layer (/src/services/*)
    ↓
Supabase Client
    ↓
PostgreSQL + RLS Policies
```

**Example:**

```typescript
// ✅ Correct: Component → Hook → Service → Supabase
// Component
function YarnMasterList() {
  const { data, isLoading } = useYarnMaterials();
  return <table>{data?.map(yarn => ...)}</table>;
}

// Hook (/src/hooks/useYarnMaterials.ts)
export function useYarnMaterials() {
  return useQuery({
    queryKey: ['yarn_materials'],
    queryFn: () => yarnsService.list(),
  });
}

// Service (/src/services/yarns.ts)
export const yarnsService = {
  async list() {
    const { data, error } = await supabase.from('yarn_masters').select('*');
    if (error) throw new YarnError(error.message);
    return data;
  },
};

// ❌ WRONG: Component directly calls Supabase
function YarnMasterList() {
  const [yarns, setYarns] = useState([]);
  useEffect(() => {
    supabase.from('yarn_masters').select('*').then(r => setYarns(r.data));
  }, []);
  return <table>{yarns.map(...)}</table>;
}
```

### Service Layer Structure

```
/src/services/
├── auth.ts              # Sign in, sign out, session management
├── profiles.ts          # User profile CRUD
├── roles.ts             # Role/permission queries
├── yarns.ts             # Yarn master CRUD
├── parties.ts           # Party/supplier CRUD
├── costSheets.ts        # Cost sheet CRUD + calculations
├── inventory.ts         # Inventory transactions (append-only ledger)
├── production.ts        # Production order CRUD
├── quality.ts           # Quality inspection CRUD
├── sales.ts             # Sales order CRUD
├── audit.ts             # Audit log queries
└── error.ts             # Centralized error handling
```

### Hooks Structure

```
/src/hooks/
├── useAuth.ts           # Real Supabase Auth (not mock)
├── useYarnMaterials.ts  # Query + mutation hooks for yarns
├── useInventory.ts      # Query + mutation hooks for inventory
├── useProduction.ts     # Query + mutation hooks for production
├── useQuality.ts        # Query + mutation hooks for quality
├── useSales.ts          # Query + mutation hooks for sales
├── useCostSheets.ts     # Query + mutation hooks for costing
└── [others]
```

---

## 4. React/TanStack Conventions

### Component Organization

- Functional components only (no class components)
- Hooks for state management (useState, useEffect, useCallback)
- TanStack Query (React Query) for server state — NOT useState for API data
- Keep components under 300 lines; extract logic to hooks/services

### Naming Conventions

- Components: PascalCase (e.g., `YarnMasterList`, `CostSheetEditor`)
- Hooks: camelCase starting with `use` (e.g., `useYarnMaterials`, `useCostSheetForm`)
- Services: camelCase + `Service` suffix (e.g., `yarnsService`, `inventoryService`)
- Directories: kebab-case (e.g., `/src/components/yarn-master`, `/src/services`)

### State Management

- **Server State:** TanStack Query only (useQuery, useMutation)
- **UI State:** useState (form inputs, modals, filters)
- **URL State:** TanStack Router (useSearch, useParams)
- **Form State:** react-hook-form + Zod for validation

### Example Hook Pattern

```typescript
// ✅ Correct: TanStack Query for server state
export function useYarnMaterials() {
  return useQuery({
    queryKey: ['yarn_materials'],
    queryFn: () => yarnsService.list(),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCreateYarn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (yarn: NewYarn) => yarnsService.create(yarn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yarn_materials'] });
    },
  });
}

// In component
function YarnForm() {
  const { mutate, isPending } = useCreateYarn();
  const handleSubmit = (yarn: NewYarn) => mutate(yarn);
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 5. Supabase/PostgreSQL Conventions

### Table Naming

- Plural, snake_case: `yarn_masters`, `cost_sheets`, `production_orders`
- No prefixes or suffixes (e.g., `tbl_`, `_table`)

### Column Naming

- snake_case: `created_by`, `updated_at`, `is_active`
- Timestamps: always `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW()) and `updated_at` where mutable
- Boolean flags: prefix with `is_` (e.g., `is_active`, `is_deleted`)
- User tracking: `created_by` (VARCHAR storing user email or ID) and `updated_by` where applicable

### Required Columns (For ERP/Master Tables)

```sql
CREATE TABLE yarn_masters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,           -- Human-readable ID
  name VARCHAR(200) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),                    -- User email/ID
  updated_by VARCHAR(150)
);
```

### Constraints & Indexes

- **Primary Key:** Always UUID (generated by `uuid_generate_v4()`)
- **Unique Constraints:** On business keys (`code` field for masters)
- **Foreign Keys:** On references to other tables with `ON DELETE CASCADE` or `ON DELETE SET NULL` as appropriate
- **Indexes:** On frequently queried/filtered columns (`code`, `is_active`, `created_by`, `status`)
- **Check Constraints:** On status/enum fields (e.g., `status IN ('DRAFT', 'APPROVED', 'REJECTED')`)

### Migrations

```sql
-- supabase/migrations/20260920_create_yarn_masters.sql

CREATE TABLE IF NOT EXISTS public.yarn_masters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  denier DECIMAL(10, 2),
  rate_per_kg DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  CONSTRAINT yarn_masters_code_not_empty CHECK (length(code) > 0)
);

CREATE INDEX IF NOT EXISTS idx_yarn_masters_code ON public.yarn_masters(code);
CREATE INDEX IF NOT EXISTS idx_yarn_masters_is_active ON public.yarn_masters(is_active);
CREATE INDEX IF NOT EXISTS idx_yarn_masters_created_by ON public.yarn_masters(created_by);
```

### RLS Policies (Mandatory for All Tables)

```sql
-- Enable RLS on table
ALTER TABLE public.yarn_masters ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access" ON public.yarn_masters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'role-admin'
    )
  );

-- Viewer: Read-only
CREATE POLICY "viewer_read_only" ON public.yarn_masters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('role-admin', 'role-manager', 'role-operator', 'role-viewer')
    )
  );

-- Users cannot modify
CREATE POLICY "no_modify_without_role" ON public.yarn_masters
  FOR UPDATE, DELETE USING (FALSE);
```

---

## 6. TypeScript Strictness

### Compiler Settings (Non-Negotiable)

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmitOnError": true,
    "noUnusedLocals": false, // Allow unused (for now)
    "noUnusedParameters": false, // Allow unused
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedSideEffectImports": true
  }
}
```

### Typing Rules

1. **Never use `any`** — Always use proper types
2. **Always type function parameters and returns** — No implicit `any`
3. **Zod for runtime validation** — Not just TypeScript types
4. **Generated types:** Regenerate `/src/integrations/supabase/types.ts` after migrations

### Example

```typescript
// ❌ WRONG: any, missing types
function createYarn(data: any): any {
  return supabase.from("yarn_masters").insert(data);
}

// ✅ CORRECT: Proper types, Zod validation
const YarnSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  denier: z.number().positive(),
  rate_per_kg: z.number().positive(),
  is_active: z.boolean().default(true),
});

type Yarn = z.infer<typeof YarnSchema>;

async function createYarn(data: unknown): Promise<Yarn> {
  const validated = YarnSchema.parse(data);
  const { data: result, error } = await supabase
    .from("yarn_masters")
    .insert([validated])
    .select()
    .single();

  if (error) throw new YarnError(error.message);
  return result as Yarn;
}
```

---

## 7. Error Handling

### Centralized Error Types

```typescript
// /src/services/error.ts
export class YarnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YarnError";
  }
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authorized to perform this action");
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}
```

### Service Error Handling

```typescript
// /src/services/yarns.ts
export const yarnsService = {
  async list(): Promise<Yarn[]> {
    const { data, error } = await supabase.from("yarn_masters").select("*");
    if (error) {
      console.error("Database error:", error);
      throw new YarnError(`Failed to fetch yarns: ${error.message}`);
    }
    return data || [];
  },

  async create(yarn: unknown): Promise<Yarn> {
    const validated = YarnSchema.parse(yarn);
    const { data, error } = await supabase
      .from("yarn_masters")
      .insert([validated])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint
        throw new ValidationError("code", "This code already exists");
      }
      throw new YarnError(`Failed to create yarn: ${error.message}`);
    }
    return data as Yarn;
  },
};
```

### Component Error Display

```typescript
function YarnForm() {
  const { mutate, error, isPending } = useCreateYarn();

  useEffect(() => {
    if (error instanceof ValidationError) {
      toast.error(`${error.field}: ${error.message}`);
    } else if (error instanceof YarnError) {
      toast.error(error.message);
    } else if (error) {
      toast.error('Something went wrong');
    }
  }, [error]);

  return <form>...</form>;
}
```

---

## 8. Testing Requirements

### Mandatory Test Coverage

- [ ] Service layer: CRUD operations, error cases, validation
- [ ] Hook behavior: loading, success, error states
- [ ] Component integration: form submission, data display
- [ ] RLS policies: admin/manager/operator/viewer access levels

### Test Framework

- **Test Runner:** Vitest (planned)
- **Component Testing:** @testing-library/react
- **Database Testing:** Use test Supabase project with RLS policies

### Example Test

```typescript
// /src/services/yarns.test.ts
import { describe, it, expect } from "vitest";
import { yarnsService } from "./yarns";

describe("yarnsService", () => {
  it("should fetch all yarns", async () => {
    const yarns = await yarnsService.list();
    expect(Array.isArray(yarns)).toBe(true);
  });

  it("should validate code uniqueness", async () => {
    await expect(yarnsService.create({ code: "Y-01", name: "Existing" })).rejects.toThrow(
      "already exists",
    );
  });
});
```

---

## 9. Folder Structure

```
src/
├── components/
│   ├── ui/                      # Radix UI components (auto-generated)
│   ├── yarn-master/
│   │   ├── yarn-master-list.tsx
│   │   ├── yarn-master-form.tsx
│   │   └── yarn-master-detail.tsx
│   ├── inventory/
│   ├── production/
│   ├── cost-sheets/
│   ├── quality/
│   ├── sales/
│   ├── app-shell.tsx            # Main layout
│   └── [domain components]
├── hooks/
│   ├── useAuth.ts               # Real Supabase Auth
│   ├── useYarnMaterials.ts      # Query + mutation hooks
│   ├── [domain hooks]
│   └── use-mobile.tsx           # Utility hooks
├── services/
│   ├── auth.ts                  # Auth operations
│   ├── profiles.ts              # Profile CRUD
│   ├── roles.ts                 # Role/permission queries
│   ├── yarns.ts                 # Yarn CRUD + queries
│   ├── parties.ts               # Party CRUD
│   ├── costSheets.ts            # Cost sheet CRUD
│   ├── inventory.ts             # Inventory transactions
│   ├── production.ts            # Production CRUD
│   ├── quality.ts               # Quality CRUD
│   ├── sales.ts                 # Sales CRUD
│   ├── audit.ts                 # Audit log queries
│   └── error.ts                 # Error types
├── lib/
│   ├── validators.ts            # Zod schemas
│   ├── utils.ts                 # Utility functions
│   └── whatsapp/                # WhatsApp integration
├── integrations/
│   ├── lovable/                 # Lovable integration
│   └── supabase/
│       ├── client.ts            # Supabase client
│       └── types.ts             # Generated types
├── routes/                      # TanStack Router routes
│   ├── __root.tsx
│   ├── auth.tsx
│   ├── index.tsx                # Dashboard
│   ├── masters.$type.tsx        # Masters screens
│   ├── inventory.*.tsx          # Inventory screens
│   ├── cost-sheets.*.tsx        # Cost sheet screens
│   ├── production.*.tsx         # Production screens
│   ├── quality.*.tsx            # Quality screens
│   ├── sales.*.tsx              # Sales screens
│   └── system.*.tsx             # Admin screens
├── types/
│   └── design.ts                # Design type definitions
├── index.tsx                    # Entry point
├── root.tsx                     # Root component
└── app.css                      # Global styles

supabase/
├── migrations/
│   ├── 20260920_init_schema.sql
│   ├── 20260920_rls_policies.sql
│   └── [future migrations]
└── [config files]
```

---

## 10. Database Migration Rules

### When to Create a Migration

- Any schema change (CREATE TABLE, ALTER TABLE, ADD COLUMN, etc.)
- Any RLS policy addition
- Any index creation for performance

### Migration Naming

```
supabase/migrations/[timestamp]_[description].sql

Example:
  20260920_create_yarn_masters.sql
  20260920_create_inventory_ledger.sql
  20260920_add_rls_policies.sql
  20260921_add_indexes.sql
```

### Never

- ❌ Edit schema.sql directly after pushing
- ❌ Apply schema changes via Supabase Dashboard in production
- ❌ Rely on manual SQL; always use migration files
- ❌ Skip migration for "temporary" changes

### Always

- ✅ Test migration locally (`supabase db reset`)
- ✅ Include rollback logic (DROP TABLE IF EXISTS, etc.)
- ✅ Document why the change was needed
- ✅ Push migration files before pushing code that depends on them

---

## 11. RLS Requirements

### Mandatory for All Data Tables

Every table with sensitive/business data MUST have RLS enabled with policies for:

- **Admin:** Full access (SELECT, INSERT, UPDATE, DELETE)
- **Manager:** Module-specific (e.g., can approve cost sheets)
- **Operator:** Limited (e.g., can view and create, but not delete)
- **Viewer:** Read-only (SELECT only)
- **Default (Deny All):** Always include a restrictive default

### Example RLS Structure

```sql
ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access" ON public.cost_sheets FOR ALL
  USING (
    (SELECT p.primary_role_id FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  );

-- Manager: View, Create, Edit own
CREATE POLICY "manager_create_edit_own" ON public.cost_sheets FOR SELECT
  USING (
    (SELECT p.primary_role_id FROM public.profiles p WHERE p.id = auth.uid()) = 'manager'
  );

-- Operator: View only
CREATE POLICY "operator_view_only" ON public.cost_sheets FOR SELECT
  USING (
    (SELECT p.primary_role_id FROM public.profiles p WHERE p.id = auth.uid()) IN ('operator', 'manager', 'admin')
  );

-- Deny all by default
CREATE POLICY "deny_all" ON public.cost_sheets FOR ALL
  USING (FALSE);
```

---

## 12. Authentication Requirements

### Supabase Auth (Real, Not Mock)

- Sign-in: `supabase.auth.signInWithPassword()`
- Sign-out: `supabase.auth.signOut()`
- Session: `supabase.auth.getSession()` and `onAuthStateChange()`
- No hardcoded user objects; no localStorage-based auth flags
- Session persisted in Supabase-managed localStorage (auto-managed)

### Session Validation

```typescript
// ✅ Correct: Always validate before accessing protected resources
export async function getUserProfile() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (!session) throw new UnauthorizedError();

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError) throw new NotFoundError("Profile", session.user.id);
  return data;
}
```

---

## 13. Service/Repository Layer Requirements

### Pattern: Service as CRUD + Business Logic

```typescript
// /src/services/costSheets.ts

const CostSheetSchema = z.object({
  code_number: z.string().min(1).max(50),
  fabric_quality_name: z.string().min(1),
  reed: z.number().int().positive(),
  picks: z.number().int().positive(),
  // ... other fields
});

type CostSheet = z.infer<typeof CostSheetSchema>;
type NewCostSheet = Omit<CostSheet, "id" | "created_at" | "updated_at">;

export const costSheetsService = {
  async list(): Promise<CostSheet[]> {
    const { data, error } = await supabase
      .from("cost_sheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new CostSheetError(`Failed to fetch: ${error.message}`);
    return data || [];
  },

  async getById(id: string): Promise<CostSheet> {
    const { data, error } = await supabase.from("cost_sheets").select("*").eq("id", id).single();

    if (error) throw new NotFoundError("CostSheet", id);
    return data as CostSheet;
  },

  async create(input: unknown): Promise<CostSheet> {
    const validated = CostSheetSchema.parse(input);
    const { data, error } = await supabase
      .from("cost_sheets")
      .insert([{ ...validated, created_by: (await getAuthUser()).email }])
      .select()
      .single();

    if (error) throw new CostSheetError(`Failed to create: ${error.message}`);
    return data as CostSheet;
  },

  async update(id: string, updates: unknown): Promise<CostSheet> {
    const partial = CostSheetSchema.partial().parse(updates);
    const { data, error } = await supabase
      .from("cost_sheets")
      .update({ ...partial, updated_by: (await getAuthUser()).email, updated_at: new Date() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new CostSheetError(`Failed to update: ${error.message}`);
    return data as CostSheet;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("cost_sheets").delete().eq("id", id);

    if (error) throw new CostSheetError(`Failed to delete: ${error.message}`);
  },
};
```

---

## 14. Validation Requirements

### Zod Schemas (Always)

```typescript
// /src/lib/validators.ts

import { z } from "zod";

// Yarn validation
export const YarnSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^Y-\d+$/, "Code must be Y-01 format"),
  name: z.string().min(1).max(200),
  denier: z.number().positive(),
  rate_per_kg: z.number().positive(),
  composition: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type Yarn = z.infer<typeof YarnSchema>;

// Inventory transaction validation
export const InventoryTransactionSchema = z.object({
  item_id: z.string().uuid(),
  qty_change: z.number(),
  movement_type: z.enum(["inward", "issue", "return", "transfer"]),
  reference_doc: z.string(),
  location_from: z.string(),
  location_to: z.string(),
});

export type InventoryTransaction = z.infer<typeof InventoryTransactionSchema>;
```

### Frontend Validation (In Forms)

```typescript
function YarnForm({ initialValue }: { initialValue?: Yarn }) {
  const form = useForm({
    resolver: zodResolver(YarnSchema),
    defaultValues: initialValue || {},
  });

  return (
    <form onSubmit={form.handleSubmit(async (data) => {
      try {
        await yarnsService.create(data);
        toast.success('Yarn created');
      } catch (error) {
        if (error instanceof ValidationError) {
          form.setError(error.field as any, { message: error.message });
        } else {
          toast.error('Failed to save');
        }
      }
    })}>
      {/* Form fields */}
    </form>
  );
}
```

---

## 15. Git Safety Rules

### Mandatory Practices

1. **Never force-push** to `claude/trusting-ritchie-zg25ff`
   - Lovable is watching this branch; rewriting history breaks sync

2. **Always create new commits** (never amend pushed commits)
   - Exception: Unstaged local work before first push

3. **Review changes before pushing**

   ```bash
   git status
   git diff
   git log --oneline -5
   ```

4. **Never commit secrets**
   - `.env.local` is gitignored
   - Real Supabase keys never in `VITE_` variables in .env.example

5. **Run validation before pushing**

   ```bash
   npm run typecheck     # TypeScript
   npm run lint          # ESLint
   npm run build         # Vite build
   ```

6. **Create meaningful commit messages**
   ```
   ✅ GOOD:   "STEP 3: Replace mock authentication with Supabase Auth"
   ✅ GOOD:   "Add RLS policies for yarn_masters table"
   ✅ GOOD:   "Create inventory transaction service and hooks"
   ❌ WRONG:  "Fix stuff"
   ❌ WRONG:  "Update"
   ```

---

## 16. Code Review Before Pushing

- [ ] No `any` types
- [ ] All Supabase queries behind service layer
- [ ] RLS policies align with role permissions
- [ ] No localStorage for business data (UI cache only)
- [ ] Zod validation for user inputs
- [ ] Errors properly handled and logged
- [ ] TypeScript compilation passes
- [ ] ESLint passes
- [ ] No console.log in production code (except errors)

---

## 17. Implementation Checklist (Per Step)

When starting each STEP:

- [ ] Read CLAUDE.md (this file)
- [ ] Read AGENTS.md (Lovable constraints)
- [ ] Inspect existing code patterns
- [ ] Reuse working patterns where available
- [ ] Do NOT modify unrelated modules
- [ ] Run full validation suite after changes
- [ ] Commit with clear message
- [ ] Push to branch (never force-push)

---

## 18. Contact & Clarification

If unclear on any rule:

1. Read this file again (90% of answers are here)
2. Check existing code patterns in the repo
3. Ask Claude directly with context from STEP 0 analysis
4. DO NOT assume or guess; clarify first

---

**CLAUDE.md** — Last Updated September 20, 2026  
**Valid for entire SCKT backend development initiative**
