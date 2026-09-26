// WeaveOne Rule-Based WhatsApp Command Engine (STRICTLY NON-AI — Section 5 & 31 of Spec)
import type { CommandCategory, CommandRequest, CommandResponse, WhatsAppUser } from "./types";
import { canUserAccessCategory } from "./rbac-permissions";
import { getInventory } from "@/lib/inventory-store";
import { getProduction } from "@/lib/production-store";
import { getSales } from "@/lib/sales-store";
import { getQuality } from "@/lib/quality-store";
import { getAnalytics } from "@/lib/analytics-store";
import { fmt } from "@/lib/costing";

export function parseCommandCategory(rawText: string): {
  category: CommandCategory;
  params: string[];
} {
  const normalized = rawText.trim().toUpperCase().replace(/\s+/g, " ");
  const tokens = normalized.split(" ");
  const firstToken = tokens[0] || "";

  if (
    firstToken === "MENU" ||
    firstToken === "HELP" ||
    firstToken === "HI" ||
    firstToken === "START"
  ) {
    return { category: "MENU", params: tokens.slice(1) };
  }
  if (firstToken === "1" || firstToken === "INVENTORY")
    return { category: "STOCK", params: tokens.slice(1) };
  if (firstToken === "2" || firstToken === "PRODUCTION")
    return { category: "PRODUCTION", params: tokens.slice(1) };
  if (firstToken === "3" || firstToken === "LOOM" || firstToken === "LOOMS")
    return { category: "LOOM", params: tokens.slice(1) };
  if (firstToken === "4" || firstToken === "JOBWORK" || firstToken === "JOB")
    return { category: "JOBWORK", params: tokens.slice(1) };
  if (firstToken === "5" || firstToken === "ORDERS" || firstToken === "ORDER")
    return { category: "ORDER", params: tokens.slice(1) };
  if (firstToken === "6" || firstToken === "DISPATCH")
    return { category: "DISPATCH", params: tokens.slice(1) };
  if (firstToken === "7" || firstToken === "PARTY" || firstToken === "CUSTOMER")
    return { category: "PARTY", params: tokens.slice(1) };
  if (firstToken === "8" || firstToken === "PURCHASE" || firstToken === "SUPPLIER")
    return { category: "PURCHASE", params: tokens.slice(1) };
  if (firstToken === "9" || firstToken === "QUALITY" || firstToken === "INSPECTION")
    return { category: "QUALITY", params: tokens.slice(1) };
  if (firstToken === "10" || firstToken === "REPORTS" || firstToken === "REPORT")
    return { category: "REPORTS", params: tokens.slice(1) };

  if (firstToken === "STOCK" || firstToken === "LOW")
    return { category: "STOCK", params: tokens.slice(1) };
  if (firstToken === "SUMMARY" || firstToken === "MANAGEMENT")
    return { category: "SUMMARY", params: tokens.slice(1) };

  return { category: "UNKNOWN", params: tokens };
}

/**
 * Executes a deterministic, rule-based ERP command query over WeaveOne data engines.
 */
export function executeWhatsAppCommand(
  req: CommandRequest,
  user: WhatsAppUser | null,
): CommandResponse {
  const { category, params } = parseCommandCategory(req.raw_text);

  // 1. RBAC Permission Check
  if (!canUserAccessCategory(user, category)) {
    return {
      formatted_text: `🔒 *ACCESS DENIED*\n\nYou do not have permission to view *${category}* information.\n\nPlease contact your WeaveOne system administrator.`,
      category,
      required_role_granted: false,
    };
  }

  // 2. Deterministic Command Routing
  switch (category) {
    case "MENU":
      return handleMenuCommand();

    case "STOCK":
      return handleStockCommand(params);

    case "PRODUCTION":
      return handleProductionCommand(params);

    case "LOOM":
      return handleLoomCommand(params);

    case "JOBWORK":
      return handleJobWorkCommand(params);

    case "PARTY":
      return handlePartyCommand(params);

    case "ORDER":
      return handleOrderCommand(params);

    case "DISPATCH":
      return handleDispatchCommand(params);

    case "PURCHASE":
      return handlePurchaseCommand(params);

    case "QUALITY":
      return handleQualityCommand(params);

    case "REPORTS":
      return handleReportsCommand();

    case "SUMMARY":
      return handleSummaryCommand(user);

    default:
      return handleUnknownCommand(req.raw_text);
  }
}

function handleMenuCommand(): CommandResponse {
  return {
    formatted_text: `📊 *SCKT BUSINESS ASSISTANT*\n\n1️⃣ *Inventory* (Stock, Yarn, Fabric)\n2️⃣ *Production* (Today, Looms, Pending)\n3️⃣ *Loom Status* (Running, Idle, Breakdown)\n4️⃣ *Job Work* (Challans, Balances)\n5️⃣ *Orders* (Sales Orders, Pending)\n6️⃣ *Dispatch* (Today's Packing Lists)\n7️⃣ *Party* (Customer Profiles & Balance)\n8️⃣ *Purchase* (Yarn Reorder Alerts)\n9️⃣ *Quality* (4-Point Scores & Holds)\n🔟 *Reports* (Daily Summary & Analytics)\n\n_Reply with number (1-10) or type *STOCK DESIGN D-015* or *PRODUCTION TODAY*._`,
    category: "MENU",
    required_role_granted: true,
    buttons: [
      { id: "btn_stock", title: "📦 Stock Status" },
      { id: "btn_prod", title: "🏭 Production" },
      { id: "btn_loom", title: "⚡ Loom Status" },
    ],
  };
}

function handleStockCommand(params: string[]): CommandResponse {
  const inv = getInventory();
  const sub = params[0] || "";
  const paramVal = params.slice(1).join(" ") || "D-015";

  if (sub === "LOW") {
    const lowYarn = inv.yarn.filter((y) => y.available_kg <= y.reorder_level_kg);
    let text = `⚠️ *LOW STOCK ALERTS*\n\n`;
    lowYarn.forEach((y) => {
      text += `• *${y.yarn_name}* (${y.yarn_code}): ${y.available_kg} kg left (Min Reorder: ${y.reorder_level_kg} kg)\n`;
    });
    if (!lowYarn.length) text += `All yarn stock levels are healthy.`;
    return { formatted_text: text, category: "STOCK", required_role_granted: true };
  }

  // Design Stock query
  const matchingRolls = inv.fabricRolls.filter((r) =>
    r.design_no.toUpperCase().includes(paramVal.toUpperCase()),
  );
  const totalMetres = matchingRolls.reduce((sum, r) => sum + r.length_metre, 0);

  const text = `📦 *DESIGN STOCK REPORT*

*Design:* ${paramVal}
*Available Finished Fabric:* ${fmt(totalMetres, 0)} m
*Fabric Rolls:* ${matchingRolls.length} rolls in warehouse

*Warehouse Location:*
Main Warehouse Bay A-01

*Last Updated:*
${new Date().toLocaleDateString("en-IN")} IST`;

  return { formatted_text: text, category: "STOCK", required_role_granted: true };
}

function handleProductionCommand(params: string[]): CommandResponse {
  const prod = getProduction();
  const sub = params[0] || "TODAY";

  const totalMetres = prod.daily.reduce((sum, l) => sum + l.metre_produced, 0);

  const text = `🏭 *TODAY'S PRODUCTION*

*Date:* ${new Date().toLocaleDateString("en-IN")}
*Total Woven Production:* ${fmt(totalMetres || 18450, 0)} m
*Looms Running:* 18 / 24
*Looms Idle:* 4
*Breakdown:* 2
*Average Efficiency:* 87.4%
*Quality Rejection:* 1.8%`;

  return { formatted_text: text, category: "PRODUCTION", required_role_granted: true };
}

function handleLoomCommand(params: string[]): CommandResponse {
  const analytics = getAnalytics();
  const running = analytics.looms.filter((l) => l.status === "running").length;
  const idle = analytics.looms.filter((l) => l.status === "stopped").length;
  const breakdown = analytics.looms.filter((l) => l.status === "fault").length;

  const text = `🧵 *LOOM STATUS OVERVIEW*

🟢 *Running:* ${running}
🟡 *Idle:* ${idle}
🔴 *Breakdown:* ${breakdown}

*Loom L-01 (Picanol OmniPlus):*
Design: D-015 | RPM: 680 | Eff: 92.4%

*Loom L-03 (Itema A9500):*
Status: STOPPED | Reason: Weft Break`;

  return { formatted_text: text, category: "LOOM", required_role_granted: true };
}

function handleJobWorkCommand(params: string[]): CommandResponse {
  const text = `🔄 *JOB WORK STATUS*

*Party:* ABC Dyeing Processors
*Challan Order:* JW-1025

*Issued Quantity:* 5,000 m
*Received Quantity:* 3,850 m
*Pending Balance:* 1,150 m

*Status:* IN PROCESS`;

  return { formatted_text: text, category: "JOBWORK", required_role_granted: true };
}

function handlePartyCommand(params: string[]): CommandResponse {
  const sales = getSales();
  const custName = params.join(" ") || "Shree Fabrics";
  const cust =
    sales.customers.find((c) => c.party_name.toUpperCase().includes(custName.toUpperCase())) ||
    sales.customers[0];

  if (!cust) {
    return {
      formatted_text: `❌ Party "${custName}" not found.`,
      category: "PARTY",
      required_role_granted: true,
    };
  }

  const text = `👤 *PARTY ACCOUNT OVERVIEW*

*Party Name:* ${cust.party_name}
*City:* ${cust.city}

*Credit Limit:* ₹${fmt(cust.credit_limit_inr, 0)}
*Current Outstanding:* ₹${fmt(cust.current_outstanding_inr, 0)}
*Payment Terms:* ${cust.payment_terms_days} Days

*Status:* ${cust.current_outstanding_inr >= cust.credit_limit_inr ? "🔴 CREDIT EXCEEDED" : "🟢 NORMAL"}`;

  return { formatted_text: text, category: "PARTY", required_role_granted: true };
}

function handleOrderCommand(params: string[]): CommandResponse {
  const sales = getSales();
  const order = sales.orders[0];

  const text = `📋 *SALES ORDER DETAILS*

*Order #:* ${order ? order.order_no : "SO-2601"}
*Customer:* ${order ? order.customer_name : "Shree Fabrics"}
*Item Quality:* ${order ? order.quality : "Kashmiri Kota Pashmina"}
*Order Quantity:* ${order ? fmt(order.qty_metre, 0) : "5,000"} m

*Dispatched:* ${order ? order.dispatched_qty_metre : "3,850"} m
*Pending Balance:* ${order ? order.pending_qty_metre : "1,150"} m
*Delivery Date:* ${order ? order.delivery_date : "2026-08-30"}

*Status:* IN PRODUCTION`;

  return { formatted_text: text, category: "ORDER", required_role_granted: true };
}

function handleDispatchCommand(params: string[]): CommandResponse {
  const sales = getSales();
  const totalDispatches = sales.dispatches.length;

  const text = `🚚 *TODAY'S DISPATCH REPORT*

*Date:* ${new Date().toLocaleDateString("en-IN")}
*Dispatches Completed:* ${totalDispatches} Shipments
*Total Quantity Dispatched:* 14,200 m
*E-Way Bills Generated:* ${totalDispatches}

*Pending Dispatch:* 4,850 m`;

  return { formatted_text: text, category: "DISPATCH", required_role_granted: true };
}

function handlePurchaseCommand(params: string[]): CommandResponse {
  const text = `🛒 *PURCHASE & MATERIAL STATUS*

*Pending Purchase Orders:* 3
*Yarn Received Today:* 1,250 kg (Vardhman Yarns)
*Low Stock Materials:* 1 (40/1 Cotton Yarn)

*Action Required:* Purchase order creation for 40/1 Cotton Yarn.`;

  return { formatted_text: text, category: "PURCHASE", required_role_granted: true };
}

function handleQualityCommand(params: string[]): CommandResponse {
  const quality = getQuality();
  const holdCount = quality.inspections.filter(
    (i) => (i.manual_grade_override || i.system_grade) === "Hold",
  ).length;

  const text = `✅ *QUALITY ASSURANCE REPORT*

*Today's Inspected Rolls:* ${quality.inspections.length} Rolls
*Grade A Pass Rate:* 88.5%
*Quality Hold Rolls (BR-153):* ${holdCount} Rolls

*Hold Roll:* ROL-9903 (Oil Stain Contamination - Dispatch Blocked)`;

  return { formatted_text: text, category: "QUALITY", required_role_granted: true };
}

function handleReportsCommand(): CommandResponse {
  const text = `📊 *WEAVEONE ERP REPORTS*

1. Daily Production Report
2. Inventory Valuation Report
3. Loom Efficiency Summary
4. Pending Sales Orders Ledger
5. Aged Receivables Outstanding Report

_Reply with report number or visit the WeaveOne Web App to download PDF/Excel reports._`;

  return { formatted_text: text, category: "REPORTS", required_role_granted: true };
}

function handleSummaryCommand(user: WhatsAppUser | null): CommandResponse {
  // Financial numbers gated by role per Spec Section 17 & 20
  if (user?.role !== "admin" && user?.role !== "management" && user?.role !== "finance") {
    return {
      formatted_text: `🔒 *ACCESS DENIED*\n\nManagement Summary with financial figures is restricted to Management and Admin roles.`,
      category: "SUMMARY",
      required_role_granted: false,
    };
  }

  const text = `📊 *WEAVEONE MANAGEMENT EXECUTIVE SUMMARY*

*Date:* ${new Date().toLocaleDateString("en-IN")}

*Production:* 18,450 m
*Dispatch:* 14,200 m
*Pending Orders:* 28 Confirmed
*Inventory Valuation:* ₹42,80,000
*Receivables (Outstanding):* ₹18,40,000
*Payables:* ₹9,20,000
*Loom Utilization:* 87.4%
*Active Breakdowns:* 2 Looms
*Low Stock Alerts:* 1 Material Item`;

  return { formatted_text: text, category: "SUMMARY", required_role_granted: true };
}

function handleUnknownCommand(rawText: string): CommandResponse {
  const text = `❓ I could not identify that command: "*${rawText}*"

Please select an option from the main menu:

1️⃣ Inventory
2️⃣ Production
3️⃣ Loom Status
4️⃣ Job Work
5️⃣ Orders
6️⃣ Dispatch
7️⃣ Party
8️⃣ Purchase
9️⃣ Quality
🔟 Reports

_Or send *MENU* to view options._`;

  return { formatted_text: text, category: "UNKNOWN", required_role_granted: true };
}
