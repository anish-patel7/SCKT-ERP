// Phase 5 — Sales, Quotation, Orders, Dispatch & Outstanding Store (M32 - M34 & M39)

export type CustomerStatus = "active" | "blocked";
export type QuoteStatus = "draft" | "sent" | "approved" | "rejected";
export type SalesOrderStatus =
  "draft" | "confirmed" | "partially_dispatched" | "completed" | "cancelled";
export type InvoiceStatus = "unpaid" | "partially_paid" | "paid" | "overdue";
export type PaymentMode = "NEFT" | "RTGS" | "Cheque" | "UPI" | "Cash";

export interface CustomerItem {
  id: string;
  code: string;
  party_name: string;
  gst_no: string;
  city: string;
  contact_person: string;
  mobile: string;
  credit_limit_inr: number;
  current_outstanding_inr: number;
  broker_name: string;
  broker_commission_pct: number;
  payment_terms_days: number;
  status: CustomerStatus;
  created_at: string;
}

export interface QuotationItem {
  id: string;
  quote_no: string;
  customer_id: string;
  customer_name: string;
  cost_sheet_id: string;
  cost_sheet_code: string;
  item_name: string;
  qty_metre: number;
  quoted_rate_per_metre: number;
  total_amount_inr: number;
  margin_pct: number;
  valid_until: string;
  status: QuoteStatus;
  created_at: string;
}

export interface SalesOrderItem {
  id: string;
  order_no: string;
  quote_id: string | null;
  customer_id: string;
  customer_name: string;
  item_code: string;
  quality: string;
  qty_metre: number;
  rate_per_metre: number;
  total_value_inr: number;
  dispatched_qty_metre: number;
  pending_qty_metre: number;
  delivery_date: string;
  broker_name: string;
  status: SalesOrderStatus;
  credit_override_approved: boolean;
  created_at: string;
}

export interface DispatchItem {
  id: string;
  dispatch_no: string;
  order_id: string;
  order_no: string;
  customer_name: string;
  dispatch_date: string;
  roll_ids: string[];
  total_metres: number;
  total_rolls: number;
  transporter_name: string;
  lr_no: string;
  vehicle_no: string;
  invoice_no: string;
  irn_e_invoice_payload: Record<string, any>;
}

export interface InvoiceItem {
  id: string;
  invoice_no: string;
  order_no: string;
  customer_name: string;
  gst_no: string;
  dispatch_no: string;
  subtotal_inr: number;
  gst_amount_inr: number;
  total_amount_inr: number;
  paid_amount_inr: number;
  balance_amount_inr: number;
  due_date: string;
  status: InvoiceStatus;
  e_way_bill_json: Record<string, any>;
}

export interface ReceiptItem {
  id: string;
  receipt_no: string;
  customer_id: string;
  customer_name: string;
  invoice_no: string;
  payment_date: string;
  amount_paid_inr: number;
  payment_mode: PaymentMode;
  reference_no: string;
  broker_commission_inr: number;
  remarks: string;
}

export interface SalesData {
  customers: CustomerItem[];
  quotations: QuotationItem[];
  orders: SalesOrderItem[];
  dispatches: DispatchItem[];
  invoices: InvoiceItem[];
  receipts: ReceiptItem[];
}

const STORAGE_KEY = "weaveone_sales_v1";

const SEED: SalesData = {
  customers: [
    {
      id: "cust-001",
      code: "CUST-001",
      party_name: "Shree Fabrics Pvt Ltd",
      gst_no: "24AAACS1234F1Z5",
      city: "Surat",
      contact_person: "Mukesh Shah",
      mobile: "9825100111",
      credit_limit_inr: 1500000,
      current_outstanding_inr: 850000,
      broker_name: "Rajeshwar Trading Co.",
      broker_commission_pct: 1.5,
      payment_terms_days: 30,
      status: "active",
      created_at: "2026-07-15T09:00:00Z",
    },
    {
      id: "cust-002",
      code: "CUST-002",
      party_name: "Ravi Textiles",
      gst_no: "24BBAAR5678K1Z8",
      city: "Ahmedabad",
      contact_person: "Suresh Patel",
      mobile: "9879000222",
      credit_limit_inr: 800000,
      current_outstanding_inr: 780000, // Near limit
      broker_name: "Jay Ambe Agency",
      broker_commission_pct: 2.0,
      payment_terms_days: 45,
      status: "active",
      created_at: "2026-07-20T10:30:00Z",
    },
    {
      id: "cust-003",
      code: "CUST-003",
      party_name: "Vardhman Creations",
      gst_no: "27CCACV9988P1Z2",
      city: "Mumbai",
      contact_person: "Ketan Mehta",
      mobile: "9820000333",
      credit_limit_inr: 500000,
      current_outstanding_inr: 550000, // Credit Exceeded!
      broker_name: "Direct",
      broker_commission_pct: 0,
      payment_terms_days: 30,
      status: "active",
      created_at: "2026-07-25T14:00:00Z",
    },
  ],
  quotations: [
    {
      id: "qt-001",
      quote_no: "QT-2601",
      customer_id: "cust-001",
      customer_name: "Shree Fabrics Pvt Ltd",
      cost_sheet_id: "cs-sample-001",
      cost_sheet_code: "CS-001",
      item_name: "Kashmiri Kota Pashmina Dress Fabric",
      qty_metre: 5000,
      quoted_rate_per_metre: 168,
      total_amount_inr: 840000,
      margin_pct: 12.5,
      valid_until: "2026-09-15",
      status: "approved",
      created_at: "2026-08-01T10:00:00Z",
    },
    {
      id: "qt-002",
      quote_no: "QT-2602",
      customer_id: "cust-002",
      customer_name: "Ravi Textiles",
      cost_sheet_id: "cs-sample-002",
      cost_sheet_code: "CS-002",
      item_name: "Banarasi Silk Brocade Saree Fabric",
      qty_metre: 2500,
      quoted_rate_per_metre: 310,
      total_amount_inr: 775000,
      margin_pct: 15.0,
      valid_until: "2026-09-30",
      status: "sent",
      created_at: "2026-08-03T11:30:00Z",
    },
  ],
  orders: [
    {
      id: "so-001",
      order_no: "SO-2601",
      quote_id: "qt-001",
      customer_id: "cust-001",
      customer_name: "Shree Fabrics Pvt Ltd",
      item_code: "ITEM-001",
      quality: "Kashmiri Kota Pashmina",
      qty_metre: 5000,
      rate_per_metre: 168,
      total_value_inr: 840000,
      dispatched_qty_metre: 120,
      pending_qty_metre: 4880,
      delivery_date: "2026-09-20",
      broker_name: "Rajeshwar Trading Co.",
      status: "partially_dispatched",
      credit_override_approved: false,
      created_at: "2026-08-02T12:00:00Z",
    },
    {
      id: "so-002",
      order_no: "SO-2602",
      quote_id: null,
      customer_id: "cust-002",
      customer_name: "Ravi Textiles",
      item_code: "ITEM-002",
      quality: "Banarasi Silk Brocade",
      qty_metre: 2000,
      rate_per_metre: 310,
      total_value_inr: 620000,
      dispatched_qty_metre: 0,
      pending_qty_metre: 2000,
      delivery_date: "2026-09-30",
      broker_name: "Jay Ambe Agency",
      status: "confirmed",
      credit_override_approved: true, // Approved via manager credit override
      created_at: "2026-08-05T15:00:00Z",
    },
  ],
  dispatches: [
    {
      id: "dsp-001",
      dispatch_no: "DSP-8801",
      order_id: "so-001",
      order_no: "SO-2601",
      customer_name: "Shree Fabrics Pvt Ltd",
      dispatch_date: "2026-08-06T14:00:00Z",
      roll_ids: ["rol-1001"], // Rol 9901 (120m)
      total_metres: 120,
      total_rolls: 1,
      transporter_name: "V-Trans India Ltd",
      lr_no: "LR-994812",
      vehicle_no: "GJ-05-BX-4810",
      invoice_no: "INV-2601",
      irn_e_invoice_payload: {
        IRN: "481a8c9e0012bc4f991e0029",
        AckNo: 1120491823,
        AckDt: "2026-08-06 14:05:00",
        EwayBillNo: 241099881122,
        Status: "ACT",
      },
    },
  ],
  invoices: [
    {
      id: "inv-001",
      invoice_no: "INV-2601",
      order_no: "SO-2601",
      customer_name: "Shree Fabrics Pvt Ltd",
      gst_no: "24AAACS1234F1Z5",
      dispatch_no: "DSP-8801",
      subtotal_inr: 20160, // 120m * 168
      gst_amount_inr: 2419.2, // 12% GST
      total_amount_inr: 22579.2,
      paid_amount_inr: 0,
      balance_amount_inr: 22579.2,
      due_date: "2026-09-05",
      status: "unpaid",
      e_way_bill_json: {
        ewbNo: 241099881122,
        ewbDate: "06/08/2026",
        validUpto: "08/08/2026",
        fromPincode: 395002,
        toPincode: 395006,
      },
    },
  ],
  receipts: [
    {
      id: "rcp-001",
      receipt_no: "RCP-1001",
      customer_id: "cust-001",
      customer_name: "Shree Fabrics Pvt Ltd",
      invoice_no: "INV-2598",
      payment_date: "2026-08-01",
      amount_paid_inr: 250000,
      payment_mode: "RTGS",
      reference_no: "UTIBH260801992",
      broker_commission_inr: 3750, // 1.5%
      remarks: "Payment received against prior invoice INV-2598",
    },
  ],
};

export function getSales(): SalesData {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return SEED;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
}

export function saveSales(data: SalesData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
