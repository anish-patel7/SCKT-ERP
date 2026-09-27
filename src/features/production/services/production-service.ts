/**
 * ProductionService — the only thing Production screens talk to.
 *
 * Today: ProductionDemoService (in memory, per browser tab, nothing persisted).
 * Later: a SupabaseProductionService implementing this same interface through services /
 * RPCs running inside PostgreSQL transactions. Route components never call Supabase.
 *
 * Every rule enforced by an implementation of this interface in the browser is for user
 * experience only. FINAL BACKEND MUST VALIDATE AGAIN (quantities, balances, stock,
 * permissions, document numbering) and apply linked updates atomically.
 */
import type {
  DailyProductionLineRow,
  DateRange,
  InputOf,
  JobCardAdjustmentInput,
  ProductionDraft,
  ProductionKind,
  ProductionMasters,
  RowOf,
  TraceStage,
} from "@/features/production/types/production";

export class ProductionValidationError extends Error {
  constructor(
    /** Input field the message belongs to, or "form" for document-level problems. */
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ProductionValidationError";
  }
}

export class ProductionUnavailableError extends Error {
  constructor() {
    super(
      "Production transactions are not connected to the database yet. " +
        "This screen is available for review in frontend demo mode only.",
    );
    this.name = "ProductionUnavailableError";
  }
}

export type StockQuery =
  | { kind: "yarn"; warehouseId: string; yarnId: string }
  | { kind: "fabric"; warehouseId: string; itemId: string; yarnId: string }
  /** Source available for cutting: received on the job order's cards minus earlier cutting. */
  | { kind: "cuttingSource"; jobOrderId: string; itemId: string; yarnId: string };

export type CreatedDocument = { id: string; number: string };

export interface ProductionService {
  /** "demo" = in-memory frontend adapter; "unavailable" = no backend connected yet. */
  readonly mode: "demo" | "unavailable";

  getMasters(): Promise<ProductionMasters>;

  list<K extends ProductionKind>(kind: K, range?: DateRange): Promise<RowOf<K>[]>;
  /** Validate and post a document, applying its linked quantity effects. */
  create<K extends ProductionKind>(kind: K, input: InputOf<K>): Promise<CreatedDocument>;

  listDrafts<K extends ProductionKind>(kind: K): Promise<ProductionDraft<K>[]>;
  /** Drafts are saved without validation and have no quantity effects until posted. */
  saveDraft<K extends ProductionKind>(
    kind: K,
    input: InputOf<K>,
    draftId?: string,
  ): Promise<ProductionDraft<K>>;
  postDraft<K extends ProductionKind>(kind: K, draftId: string): Promise<CreatedDocument>;
  deleteDraft(kind: ProductionKind, draftId: string): Promise<void>;

  /** Controlled job card adjustment (backend: separate permission + mandatory reason). */
  adjustJobCard(input: JobCardAdjustmentInput): Promise<void>;

  /** Demo stock / availability figures shown next to quantity inputs. */
  getAvailableQty(query: StockQuery): Promise<number>;

  /** Production lines joined with job card context, for the daily report. */
  listDailyProductionLines(range: DateRange): Promise<DailyProductionLineRow[]>;

  /** Linked documents from Sales Order to Stock Conversion for one job order. */
  traceJobOrder(jobOrderId: string): Promise<TraceStage[]>;
}
