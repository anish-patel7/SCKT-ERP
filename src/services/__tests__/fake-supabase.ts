/**
 * Minimal in-memory stand-in for the Supabase client, covering the query-builder calls used by
 * the Yarn and Warehouse services. Models warehouses.warehouse_code UNIQUE (23505), ILIKE with
 * escaped wildcards, and PGRST116 when .single() finds no row.
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string; message: string } | null };

type TableName = "materials" | "warehouses";
export const tables: Record<TableName, Row[]> = { materials: [], warehouses: [] };
export const inserted: Record<TableName, Row[]> = { materials: [], warehouses: [] };
export const SESSION_USER_ID = "00000000-0000-4000-8000-000000000001";

const UNIQUE: Record<string, string[]> = { warehouses: ["warehouse_code"] };
const DEFAULTS: Record<string, Row> = {
  materials: { uom: "KG", active: true, remarks: null, composition: null, denier: null },
  warehouses: { status: "Active", is_active: true, country: "India" },
};

let seq = 0;
/** Hook to simulate a concurrent writer: runs once before the next insert executes. */
export let beforeNextInsert: (() => void) | null = null;
export function setBeforeNextInsert(fn: (() => void) | null): void {
  beforeNextInsert = fn;
}

export function resetTables(): void {
  for (const key of Object.keys(tables) as TableName[]) {
    tables[key] = [];
    inserted[key] = [];
  }
  beforeNextInsert = null;
}

function likeToRegex(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "\\" && i + 1 < pattern.length) {
      out += pattern[++i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`, "i");
}

function builder(table: TableName) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row | Row[] | undefined;
  let single = false;
  let limit: number | undefined;

  const exec = (): Result => {
    const rows = tables[table];
    if (op === "insert") {
      beforeNextInsert?.();
      beforeNextInsert = null;
      const out: Row[] = [];
      for (const input of payload as Row[]) {
        for (const col of UNIQUE[table] ?? []) {
          if (rows.some((r) => r[col] === input[col])) {
            return { data: null, error: { code: "23505", message: `duplicate key (${col})` } };
          }
        }
        const row = { id: `id-${++seq}`, ...DEFAULTS[table], ...input };
        rows.push(row);
        inserted[table].push(input);
        out.push(row);
      }
      return { data: single ? out[0] : out, error: null };
    }
    let matched = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      const changes = Object.fromEntries(
        Object.entries(payload as Row).filter(([, v]) => v !== undefined),
      );
      matched.forEach((r) => Object.assign(r, changes));
    }
    if (op === "delete") {
      tables[table] = rows.filter((r) => !matched.includes(r));
    }
    if (limit !== undefined) matched = matched.slice(0, limit);
    if (single) {
      if (matched.length !== 1) {
        return { data: null, error: { code: "PGRST116", message: "0 rows" } };
      }
      return { data: { ...matched[0] }, error: null };
    }
    return { data: matched.map((r) => ({ ...r })), error: null };
  };

  const b = {
    select: () => b,
    order: () => b,
    eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), b),
    neq: (col: string, val: unknown) => (filters.push((r) => r[col] !== val), b),
    ilike: (col: string, pattern: string) => {
      const re = likeToRegex(pattern);
      filters.push((r) => re.test(String(r[col] ?? "")));
      return b;
    },
    limit: (n: number) => ((limit = n), b),
    single: () => ((single = true), b),
    insert: (rows: Row[]) => ((op = "insert"), (payload = rows), b),
    update: (changes: Row) => ((op = "update"), (payload = changes), b),
    delete: () => ((op = "delete"), b),
    then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve().then(exec).then(resolve, reject),
  };
  return b;
}

export const fakeSupabase = {
  from: (table: TableName) => builder(table),
  auth: {
    getSession: async () => ({
      data: { session: { user: { id: SESSION_USER_ID } } },
      error: null,
    }),
  },
};
