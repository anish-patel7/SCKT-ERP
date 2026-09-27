import { beforeEach, describe, expect, it } from "vitest";
import { ProductionDemoService } from "@/features/production/demo/production-demo-service";
import { ProductionValidationError } from "@/features/production/services/production-service";
import { todayIso } from "@/features/production/utils/formatting";
import type { JobCardRow } from "@/features/production/types/production";

const today = todayIso();
let svc: ProductionDemoService;

async function rejection(promise: Promise<unknown>): Promise<ProductionValidationError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProductionValidationError);
  return error as ProductionValidationError;
}

async function jobOrderId(number: string): Promise<string> {
  const jo = (await svc.list("jobOrder")).find((j) => j.number === number);
  if (!jo) throw new Error(`job order ${number} missing`);
  return jo.id;
}

async function card(number: string): Promise<JobCardRow> {
  const found = (await svc.list("jobCard")).find((c) => c.number === number);
  if (!found) throw new Error(`job card ${number} missing`);
  return found;
}

beforeEach(() => {
  svc = new ProductionDemoService();
});

describe("fixtures", () => {
  it("seed JCO/2866 → JCI/3244: issued 120, daily production 30, balance 90, Pending", async () => {
    const jc = await card("JCI/3244");
    expect(jc.jobOrderNo).toBe("JCO/2866");
    expect(jc.partyName).toBe("LABDHI SAREES");
    expect(jc.machineName).toBe("LOOM-33");
    expect(jc).toMatchObject({
      issuedQty: 120,
      receivedQty: 30,
      balanceQty: 90,
      status: "Pending",
    });
    expect(jc.documentStatus).toBe("POSTED");
  });
});

describe("Phase 45 — daily production updates the job card", () => {
  it("adding 90 closes JCI/3244; any further production is rejected", async () => {
    const jc = await card("JCI/3244");
    const doc = await svc.create("dailyProduction", {
      date: today,
      warehouseId: "wh-grey",
      unitId: "unit-1",
      receiveType: "DAILY PRODUCTION",
      remark: "",
      lines: [{ jobCardId: jc.id, qty: 90, saleRate: 0, pickRate: 0.32, rate: 38.75 }],
    });
    expect(doc.number).toBe("DPR/1883");
    expect(await card("JCI/3244")).toMatchObject({
      receivedQty: 120,
      balanceQty: 0,
      status: "Close",
    });

    const error = await rejection(
      svc.create("dailyProduction", {
        date: today,
        warehouseId: "wh-grey",
        unitId: "unit-1",
        receiveType: "DAILY PRODUCTION",
        remark: "",
        lines: [{ jobCardId: jc.id, qty: 1, saleRate: 0, pickRate: 0, rate: 0 }],
      }),
    );
    expect(error.field).toBe("lines.0.qty");
  });

  it("checks the total of several lines for the same job card", async () => {
    const jc = await card("JCI/3244");
    const line = { jobCardId: jc.id, qty: 50, saleRate: 0, pickRate: 0, rate: 0 };
    await rejection(
      svc.create("dailyProduction", {
        date: today,
        warehouseId: "wh-grey",
        unitId: "unit-1",
        receiveType: "DAILY PRODUCTION",
        remark: "",
        lines: [line, line],
      }),
    );
    expect((await card("JCI/3244")).receivedQty).toBe(30);
  });

  it("job card receipts share the balance; receive above outstanding is rejected", async () => {
    const jc = await card("JCI/3245"); // issued 200, received 40 production + 50 receipt
    expect(jc.balanceQty).toBe(110);
    const receipt = {
      date: today,
      jobCardId: jc.id,
      unitId: "unit-1",
      beamId: null,
      receiveQty: 111,
      saleQty: 0,
      stockQty: 111,
      stockStatus: "Stock",
      pickRate: 0.28,
      remark: "",
    };
    expect((await rejection(svc.create("jobCardReceipt", receipt))).field).toBe("receiveQty");
    await svc.create("jobCardReceipt", { ...receipt, receiveQty: 110, stockQty: 110 });
    expect(await card("JCI/3245")).toMatchObject({
      receivedQty: 200,
      balanceQty: 0,
      status: "Close",
    });
  });

  it("demo adjustment reduces the balance and requires a reason", async () => {
    const jc = await card("JCI/3244");
    expect(
      (await rejection(svc.adjustJobCard({ jobCardId: jc.id, date: today, qty: 5, reason: " " })))
        .field,
    ).toBe("reason");
    await svc.adjustJobCard({ jobCardId: jc.id, date: today, qty: 5, reason: "Short length" });
    expect(await card("JCI/3244")).toMatchObject({ adjustmentQty: 5, balanceQty: 85 });
  });
});

describe("Phase 46 — yarn issue / return", () => {
  it("issue 100, return 20 → outstanding 80; return 90 rejected; stock restored", async () => {
    const jo = await jobOrderId("JCO/2866");
    const stockBefore = await svc.getAvailableQty({
      kind: "yarn",
      warehouseId: "wh-yarn",
      yarnId: "yn-cotton",
    });
    const issue = await svc.create("yarnIssue", {
      date: today,
      jobOrderId: jo,
      warehouseId: "wh-yarn",
      unitId: "unit-1",
      yarnId: "yn-cotton",
      qty: 100,
      rate: 150,
      remark: "",
    });
    expect(
      await svc.getAvailableQty({ kind: "yarn", warehouseId: "wh-yarn", yarnId: "yn-cotton" }),
    ).toBe(stockBefore - 100);
    await svc.create("yarnReturn", { date: today, yarnIssueId: issue.id, qty: 20, remark: "" });
    const row = (await svc.list("yarnIssue")).find((i) => i.id === issue.id);
    expect(row).toMatchObject({ qty: 100, returnedQty: 20, outstandingQty: 80 });

    const error = await rejection(
      svc.create("yarnReturn", { date: today, yarnIssueId: issue.id, qty: 90, remark: "" }),
    );
    expect(error.field).toBe("qty");
    expect(error.message).toContain("80.000");
    expect(
      await svc.getAvailableQty({ kind: "yarn", warehouseId: "wh-yarn", yarnId: "yn-cotton" }),
    ).toBe(stockBefore - 80);
  });

  it("rejects issue above demo available stock", async () => {
    const jo = await jobOrderId("JCO/2866");
    const error = await rejection(
      svc.create("yarnIssue", {
        date: today,
        jobOrderId: jo,
        warehouseId: "wh-yarn",
        unitId: "unit-1",
        yarnId: "yn-zari",
        qty: 200.001,
        rate: 0,
        remark: "",
      }),
    );
    expect(error.field).toBe("qty");
  });
});

describe("Phases 47 / 48 — butta and mill issue ↔ receive", () => {
  it.each([
    ["butta", "buttaIssue", "buttaReceipt", "wh-grey"],
    ["mill", "millIssue", "millReceipt", null],
  ] as const)(
    "%s: issue 100, receive 40 → 60, receive 60 → Close",
    async (_p, issueKind, receiptKind, wh) => {
      const jo = await jobOrderId("JCO/2865");
      const issue = await svc.create(issueKind, {
        date: today,
        warehouseId: wh,
        partyId: "jw-surat",
        jobOrderId: jo,
        itemId: "it-620",
        yarnId: "yn-poly-beige",
        qty: 100,
        metres: 600,
        remark: "",
      });
      const receive = (qty: number) =>
        svc.create(receiptKind, {
          date: today,
          issueId: issue.id,
          warehouseId: "wh-fin",
          receiveQty: qty,
          metres: 0,
          saleQty: 0,
          stockQty: qty,
          stockStatus: "Stock",
          rate: 0,
          remark: "",
        });
      await receive(40);
      const row = async () => (await svc.list(issueKind)).find((i) => i.id === issue.id);
      expect(await row()).toMatchObject({ receivedQty: 40, balanceQty: 60, status: "Pending" });
      expect((await rejection(receive(60.5))).field).toBe("receiveQty");
      await receive(60);
      expect(await row()).toMatchObject({ receivedQty: 100, balanceQty: 0, status: "Close" });
    },
  );

  it("a receipt cannot reference an issue of the other process", async () => {
    const millIssue = (await svc.list("millIssue"))[0]!;
    const error = await rejection(
      svc.create("buttaReceipt", {
        date: today,
        issueId: millIssue.id,
        warehouseId: "wh-fin",
        receiveQty: 1,
        metres: 0,
        saleQty: 0,
        stockQty: 1,
        stockStatus: "Stock",
        rate: 0,
        remark: "",
      }),
    );
    expect(error.field).toBe("issueId");
  });
});

describe("Phase 49 — fabric stock transfer", () => {
  it("A 100 → transfer 30 → A 70, B +30; same warehouse rejected", async () => {
    const q = (warehouseId: string) =>
      svc.getAvailableQty({ kind: "fabric", warehouseId, itemId: "it-501", yarnId: "yn-vis-red" });
    expect(await q("wh-grey")).toBe(100);
    const before = await q("wh-fin");
    const input = {
      date: today,
      fromWarehouseId: "wh-grey",
      toWarehouseId: "wh-fin",
      jobCardId: null,
      itemId: "it-501",
      yarnId: "yn-vis-red",
      qty: 30,
      remark: "",
    };
    await svc.create("fabricTransfer", input);
    expect(await q("wh-grey")).toBe(70);
    expect(await q("wh-fin")).toBe(before + 30);
    expect(
      (await rejection(svc.create("fabricTransfer", { ...input, toWarehouseId: "wh-grey" }))).field,
    ).toBe("toWarehouseId");
    expect((await rejection(svc.create("fabricTransfer", { ...input, qty: 70.001 }))).field).toBe(
      "qty",
    );
  });
});

describe("Phase 50 — fabric stock conversion", () => {
  const base = async () => ({
    date: today,
    conversionType: "Fabric Conversion",
    warehouseId: "wh-main",
    convertBy: "Tester",
    productName: "Test",
    quantityPreserving: false,
    remark: "",
    stockOut: [
      {
        jobOrderId: await jobOrderId("JCO/2866"),
        itemId: "it-501",
        yarnId: "yn-vis-red",
        unitId: "unit-1",
        boxNo: "B1",
        qty: 12.5,
        remark: "",
      },
      {
        jobOrderId: await jobOrderId("JCO/2866"),
        itemId: "it-501",
        yarnId: "yn-vis-red",
        unitId: "unit-1",
        boxNo: "B2",
        qty: 7.5,
        remark: "",
      },
    ],
    stockIn: [{ itemId: "it-710", unitId: "unit-1", qty: 19, remark: "" }],
  });

  it("keeps both sides on one document with totals and difference", async () => {
    const doc = await svc.create("fabricConversion", await base());
    const row = (await svc.list("fabricConversion")).find((c) => c.id === doc.id)!;
    expect(row.stockOut).toHaveLength(2);
    expect(row.stockIn).toHaveLength(1);
    expect(row).toMatchObject({ totalOutQty: 20, totalInQty: 19, differenceQty: -1 });
  });

  it("quantity-preserving option requires equal totals", async () => {
    const error = await rejection(
      svc.create("fabricConversion", { ...(await base()), quantityPreserving: true }),
    );
    expect(error.field).toBe("stockIn");
  });
});

describe("drafts, numbering and traceability", () => {
  it("drafts have no quantity effect until posted, then get the next number", async () => {
    const jc = await card("JCI/3244");
    const input = {
      date: today,
      jobCardId: jc.id,
      unitId: "unit-1",
      beamId: null,
      receiveQty: 10,
      saleQty: 0,
      stockQty: 10,
      stockStatus: "Stock",
      pickRate: 0,
      remark: "",
    };
    const draft = await svc.saveDraft("jobCardReceipt", input);
    expect((await card("JCI/3244")).receivedQty).toBe(30);
    const posted = await svc.postDraft("jobCardReceipt", draft.id);
    expect(posted.number).toBe("JCR/0974");
    expect((await card("JCI/3244")).receivedQty).toBe(40);
    expect(await svc.listDrafts("jobCardReceipt")).toEqual([]);
  });

  it("a rejected document changes nothing and consumes no number", async () => {
    const jo = await jobOrderId("JCO/2866");
    await rejection(
      svc.create("jobOrder", {
        date: today,
        orderPartyId: "pt-labdhi",
        salesOrderId: "so-118",
        partyOrderNo: "",
        itemId: "it-501",
        yarnId: "yn-vis-red",
        qty: 0,
        rate: 1,
        remark: "",
      }),
    );
    const next = await svc.create("jobOrder", {
      date: today,
      orderPartyId: "pt-labdhi",
      salesOrderId: "so-118",
      partyOrderNo: "",
      itemId: "it-501",
      yarnId: "yn-vis-red",
      qty: 12.345,
      rate: 10.1,
      remark: "",
    });
    expect(next.number).toBe("JCO/2867");
    const row = (await svc.list("jobOrder")).find((j) => j.id === next.id)!;
    expect(row.amount).toBe(124.68); // 12.345 × 10.10 = 124.6845 → 124.68
    expect(jo).toBeTruthy();
  });

  it("traces JCO/2866 from sales order to stock conversion", async () => {
    const stages = await svc.traceJobOrder(await jobOrderId("JCO/2866"));
    expect(stages.map((s) => s.stage)).toEqual([
      "Sales Order",
      "Job Order",
      "Job Card",
      "Yarn Issue",
      "Yarn Return",
      "Daily Production",
      "Butta Cutting",
      "Cutting",
      "Stock Conversion",
    ]);
    expect(stages[0]!.documents[0]!.number).toBe("SO/2026/118");
  });
});
