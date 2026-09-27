import { beforeEach, describe, expect, it } from "vitest";
import { ProductionDemoService } from "@/features/production/demo/production-demo-service";
import { ProductionValidationError } from "@/features/production/services/production-service";
import { WarpingDemoService } from "@/features/production/warping/warping-demo-service";
import { WarpingValidationError } from "@/features/production/warping/warping-types";
import { DEMO_MASTERS } from "@/features/production/demo/production-demo-data";
import { addDays, todayIso } from "@/lib/erp/formatting";

const today = todayIso();

async function error(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e,
  );
}

describe("Job Order — fields carried over from Production Orders", () => {
  let svc: ProductionDemoService;
  beforeEach(() => {
    svc = new ProductionDemoService();
  });

  const base = {
    date: today,
    orderPartyId: "pt-labdhi",
    salesOrderId: "so-118",
    partyOrderNo: "",
    itemId: "it-501",
    yarnId: "yn-vis-red",
    qty: 100,
    rate: 10,
    remark: "",
  };

  it("defaults priority to normal and delivery date to empty", async () => {
    const created = await svc.create("jobOrder", base);
    const row = (await svc.list("jobOrder")).find((j) => j.id === created.id);
    expect(row).toMatchObject({
      priority: "normal",
      deliveryDate: "",
      producedQty: 0,
      cardIssuedQty: 0,
    });
  });

  it("keeps priority and delivery date; rejects an invalid delivery date", async () => {
    const created = await svc.create("jobOrder", {
      ...base,
      priority: "urgent",
      deliveryDate: addDays(today, 10),
    });
    const row = (await svc.list("jobOrder")).find((j) => j.id === created.id);
    expect(row).toMatchObject({ priority: "urgent", deliveryDate: addDays(today, 10) });
    const err = await error(svc.create("jobOrder", { ...base, deliveryDate: "31/12/2026" }));
    expect(err).toBeInstanceOf(ProductionValidationError);
  });

  it("progress rolls up job card received quantity (preview)", async () => {
    const jo = (await svc.list("jobOrder")).find((j) => j.number === "JCO/2866");
    const cards = (await svc.list("jobCard")).filter((c) => c.jobOrderId === jo?.id);
    expect(jo?.cardIssuedQty).toBe(cards.reduce((s, c) => s + c.issuedQty, 0));
    expect(jo?.producedQty).toBe(cards.reduce((s, c) => s + c.receivedQty, 0));
    expect(jo?.producedQty).toBeGreaterThan(0);
  });
});

describe("Daily Production — shift and downtime carried over", () => {
  it("stores shift, yarn used and downtime; rejects negative downtime", async () => {
    const svc = new ProductionDemoService();
    const card = (await svc.list("jobCard")).find((c) => c.number === "JCI/3244");
    if (!card) throw new Error("JCI/3244 missing");
    const input = {
      date: today,
      warehouseId: "wh-grey",
      unitId: "unit-1",
      receiveType: "DAILY PRODUCTION" as const,
      remark: "",
      shift: "B" as const,
      lines: [
        {
          jobCardId: card.id,
          qty: 5,
          saleRate: 0,
          pickRate: 0,
          rate: 0,
          yarnUsedKg: 1.25,
          downtimeMin: 15,
          downtimeReason: "Power failure",
        },
      ],
    };
    const bad = await error(
      svc.create("dailyProduction", { ...input, lines: [{ ...input.lines[0]!, downtimeMin: -1 }] }),
    );
    expect(bad).toBeInstanceOf(ProductionValidationError);
    const created = await svc.create("dailyProduction", input);
    const row = (await svc.list("dailyProduction")).find((p) => p.id === created.id);
    expect(row?.shift).toBe("B");
    expect(row?.lines[0]).toMatchObject({
      yarnUsedKg: 1.25,
      downtimeMin: 15,
      downtimeReason: "Power failure",
    });
  });
});

describe("Warping beam lifecycle (provisional)", () => {
  let svc: WarpingDemoService;
  beforeEach(() => {
    svc = new WarpingDemoService();
  });

  const warp = {
    setNo: "S-9",
    beamType: "Ground",
    warpYarnId: "yn-kota-black",
    countDenier: "35 D",
    totalEnds: 5000,
    lengthMetre: 1000,
    rack: "RACK-C-01",
    remark: "",
  };
  const beamOf = async (no: string) => {
    const b = (await svc.listBeams()).find((x) => x.beamNo === no);
    if (!b) throw new Error(`${no} missing`);
    return b;
  };
  const msg = (e: unknown) => (e as WarpingValidationError).message;

  it("seeds every lifecycle state and is the same beam list Production uses", async () => {
    const beams = await svc.listBeams();
    expect(Object.fromEntries(beams.map((b) => [b.beamNo, b.status]))).toEqual({
      "BM-101": "LOADED_ON_LOOM",
      "BM-102": "IN_STORE",
      "BM-205": "LOADED_ON_LOOM",
      "BM-310": "EMPTY",
      "BM-311": "AT_WARPING",
    });
    expect((await beamOf("BM-101")).loomName).toBe("LOOM-33");
    expect(DEMO_MASTERS.beams.map((b) => b.id).sort()).toEqual(beams.map((b) => b.id).sort());
    const issues = await svc.listMaterialIssues();
    expect(issues.find((i) => i.beamNo === "BM-101")).toMatchObject({
      qtyKg: 45,
      returnedKg: 2.5,
      netIssuedKg: 42.5,
    });
  });

  it("empty inward → issue → material → production → load → unload to empty", async () => {
    await svc.inwardEmptyBeam({
      date: today,
      beamNo: "BM-400",
      beamType: "Ground",
      partyId: "",
      challanNo: "",
      rack: "E-09",
      remark: "",
    });
    expect(await beamOf("BM-400")).toMatchObject({ status: "EMPTY", warp: null, rack: "E-09" });
    const empty = await beamOf("BM-400");

    const early = await error(
      svc.issueMaterial({ date: today, beamId: empty.id, yarnId: "yn-zari", qtyKg: 5, remark: "" }),
    );
    expect(msg(early)).toMatch(/not at warping/);

    await svc.issueBeam({ beamId: empty.id, date: today, partyId: "", remark: "" });
    expect((await beamOf("BM-400")).status).toBe("AT_WARPING");
    await svc.issueMaterial({
      date: today,
      beamId: empty.id,
      yarnId: "yn-kota-black",
      qtyKg: 40,
      remark: "",
    });

    await svc.produceBeam({ ...warp, date: today, beamNo: "bm-400" });
    let row = await beamOf("BM-400");
    expect(row).toMatchObject({
      status: "IN_STORE",
      setNo: "S-9",
      totalEnds: 5000,
      qrCode: "SCKT-BEAM|BM-400|S-9",
    });

    const again = await error(svc.produceBeam({ ...warp, date: today, beamNo: "BM-400" }));
    expect(msg(again)).toMatch(/already carries a warp/);

    await svc.loadBeam({ beamId: row.id, loomId: "mc-41", date: today, remark: "" });
    await svc.unloadBeam({
      beamId: row.id,
      date: today,
      toStatus: "EMPTY",
      rack: "E-10",
      remark: "",
    });
    row = await beamOf("BM-400");
    expect(row).toMatchObject({
      status: "EMPTY",
      warp: null,
      setNo: "",
      loomId: null,
      rack: "E-10",
    });
    const kinds = (await svc.listMovements()).filter((m) => m.beamId === row.id).map((m) => m.kind);
    expect(kinds.sort()).toEqual([
      "EMPTY_INWARD",
      "ISSUED_FOR_WARPING",
      "LOADED",
      "PRODUCED",
      "UNLOADED",
    ]);
  });

  it("beam receive needs the party it was issued to; a new beam no. registers a new beam", async () => {
    const empty = await beamOf("BM-310");
    await svc.issueBeam({ beamId: empty.id, date: today, partyId: "jw-mahavir", remark: "" });
    const wrong = await error(
      svc.receiveBeam({
        ...warp,
        date: today,
        beamNo: "BM-310",
        partyId: "jw-ganesh",
        challanNo: "",
      }),
    );
    expect((wrong as WarpingValidationError).field).toBe("partyId");
    await svc.receiveBeam({
      ...warp,
      date: today,
      beamNo: "BM-310",
      partyId: "jw-mahavir",
      challanNo: "MBW/9",
    });
    expect((await beamOf("BM-310")).status).toBe("IN_STORE");
    const rc = (await svc.listMovements("RECEIVED")).find((m) => m.beamNo === "BM-310");
    expect(rc).toMatchObject({ partyName: "MAHAVIR BUTTA WORKS", challanNo: "MBW/9" });

    await svc.receiveBeam({
      ...warp,
      date: today,
      beamNo: "BM-500",
      setNo: "S-10",
      partyId: "jw-ganesh",
      challanNo: "",
    });
    expect((await beamOf("BM-500")).status).toBe("IN_STORE");
  });

  it("empty beam inward also takes back an unwarped beam from warping", async () => {
    await svc.inwardEmptyBeam({
      date: today,
      beamNo: "BM-311",
      beamType: "",
      partyId: "",
      challanNo: "",
      rack: "E-05",
      remark: "not warped",
    });
    expect((await beamOf("BM-311")).status).toBe("EMPTY");
    const dup = await error(
      svc.inwardEmptyBeam({
        date: today,
        beamNo: "BM-102",
        beamType: "Border",
        partyId: "",
        challanNo: "",
        rack: "",
        remark: "",
      }),
    );
    expect(msg(dup)).toMatch(/already registered/);
  });

  it("production loading warps and loads in one entry", async () => {
    const beam = await beamOf("BM-310");
    await svc.issueBeam({ beamId: beam.id, date: today, partyId: "", remark: "" });
    await svc.produceAndLoadBeam({ ...warp, date: today, beamNo: "BM-310", loomId: "mc-07" });
    expect(await beamOf("BM-310")).toMatchObject({
      status: "LOADED_ON_LOOM",
      loomName: "LOOM-07",
      rack: "",
    });
  });

  it("material return is limited to the net issued; updation needs a reason and keeps net ≥ 0", async () => {
    const issue = (await svc.listMaterialIssues()).find((i) => i.beamNo === "BM-311");
    if (!issue) throw new Error("BM-311 issue missing");
    expect(issue.netIssuedKg).toBe(30);
    const tooMuch = await error(
      svc.returnMaterial({ date: today, materialIssueId: issue.id, qtyKg: 31, remark: "" }),
    );
    expect(msg(tooMuch)).toMatch(/Only 30.000 kg/);
    await svc.returnMaterial({ date: today, materialIssueId: issue.id, qtyKg: 10, remark: "" });

    const noReason = await error(
      svc.updateYarnIssue({
        date: today,
        materialIssueId: issue.id,
        source: "TFO",
        qtyChangeKg: 2,
        reason: " ",
      }),
    );
    expect((noReason as WarpingValidationError).field).toBe("reason");
    await svc.updateYarnIssue({
      date: today,
      materialIssueId: issue.id,
      source: "TFO",
      qtyChangeKg: 2.5,
      reason: "TFO excess",
    });
    const below = await error(
      svc.updateYarnIssue({
        date: today,
        materialIssueId: issue.id,
        source: "BEAM",
        qtyChangeKg: -23,
        reason: "x",
      }),
    );
    expect(msg(below)).toMatch(/cannot go below zero/);

    const row = (await svc.listMaterialIssues()).find((i) => i.id === issue.id);
    expect(row).toMatchObject({ returnedKg: 10, adjustmentKg: 2.5, netIssuedKg: 22.5 });
    expect((await svc.listYarnIssueUpdates())[0]).toMatchObject({
      source: "TFO",
      beamNo: "BM-311",
    });
  });

  it("status rules: only in-store beams load, only loaded beams unload, dates never go back", async () => {
    const empty = await beamOf("BM-310");
    expect(
      msg(
        await error(svc.loadBeam({ beamId: empty.id, loomId: "mc-41", date: today, remark: "" })),
      ),
    ).toMatch(/not a warped beam in store/);
    const stored = await beamOf("BM-102");
    expect(
      msg(
        await error(
          svc.unloadBeam({
            beamId: stored.id,
            date: today,
            toStatus: "IN_STORE",
            rack: "",
            remark: "",
          }),
        ),
      ),
    ).toMatch(/not loaded/);
    const back = await error(
      svc.loadBeam({ beamId: stored.id, loomId: "mc-41", date: addDays(today, -40), remark: "" }),
    );
    expect((back as WarpingValidationError).field).toBe("date");
    const onLoom = await beamOf("BM-101");
    expect(
      msg(
        await error(
          svc.moveBeam({
            beamId: onLoom.id,
            date: today,
            toStatus: "SIZING",
            rack: "",
            remark: "",
          }),
        ),
      ),
    ).toMatch(/Beam Unload Entry/);
  });
});
