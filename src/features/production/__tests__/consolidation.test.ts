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

describe("Warping beam register (old Beam Store functions)", () => {
  let svc: WarpingDemoService;
  beforeEach(() => {
    svc = new WarpingDemoService();
  });

  const newBeam = {
    date: today,
    beamNo: "BM-300",
    setNo: "S-9",
    beamType: "Ground",
    warpYarnId: "yn-kota-black",
    countDenier: "35 D",
    totalEnds: 5000,
    lengthMetre: 1000,
    rack: "RACK-C-01",
    remark: "",
  };

  it("seeds BM-101 on LOOM-33 and is the same beam list Production uses", async () => {
    const beams = await svc.listBeams();
    expect(beams.find((b) => b.beamNo === "BM-101")).toMatchObject({
      status: "LOADED_ON_LOOM",
      loomName: "LOOM-33",
    });
    expect(DEMO_MASTERS.beams.map((b) => b.id).sort()).toEqual(beams.map((b) => b.id).sort());
  });

  it("new warped beam is in store with a QR payload; duplicate beam no. rejected", async () => {
    const beam = await svc.produceBeam(newBeam);
    expect(beam).toMatchObject({
      status: "IN_STORE",
      loomId: null,
      qrCode: "SCKT-BEAM|BM-300|S-9",
    });
    const dup = await error(svc.produceBeam({ ...newBeam, beamNo: "bm-300" }));
    expect(dup).toBeInstanceOf(WarpingValidationError);
    const bad = await error(svc.produceBeam({ ...newBeam, beamNo: "BM-301", totalEnds: 10.5 }));
    expect((bad as WarpingValidationError).field).toBe("totalEnds");
  });

  it("load → unload keeps one history per beam and enforces status", async () => {
    const beam = await svc.produceBeam(newBeam);
    await svc.loadBeam({ beamId: beam.id, loomId: "mc-41", date: today, remark: "" });
    let row = (await svc.listBeams()).find((b) => b.id === beam.id);
    expect(row).toMatchObject({ status: "LOADED_ON_LOOM", loomName: "LOOM-41", rack: "" });

    const again = await error(
      svc.loadBeam({ beamId: beam.id, loomId: "mc-07", date: today, remark: "" }),
    );
    expect((again as WarpingValidationError).message).toMatch(/already on a loom/);
    const move = await error(
      svc.moveBeam({ beamId: beam.id, date: today, toStatus: "SIZING", rack: "", remark: "" }),
    );
    expect((move as WarpingValidationError).message).toMatch(/Beam Unload Entry/);

    await svc.unloadBeam({
      beamId: beam.id,
      date: today,
      toStatus: "IN_STORE",
      rack: "RACK-C-02",
      remark: "",
    });
    row = (await svc.listBeams()).find((b) => b.id === beam.id);
    expect(row).toMatchObject({ status: "IN_STORE", loomId: null, rack: "RACK-C-02" });

    const history = (await svc.listMovements()).filter((m) => m.beamId === beam.id);
    expect(history.map((m) => m.kind).sort()).toEqual(["LOADED", "PRODUCED", "UNLOADED"]);
    const unload = history.find((m) => m.kind === "UNLOADED");
    expect(unload).toMatchObject({ fromLoomName: "LOOM-41", fromStatus: "LOADED_ON_LOOM" });
  });

  it("rejects a movement dated before the beam's last movement", async () => {
    const beam = await svc.produceBeam(newBeam);
    const err = await error(
      svc.loadBeam({ beamId: beam.id, loomId: "mc-41", date: addDays(today, -1), remark: "" }),
    );
    expect((err as WarpingValidationError).field).toBe("date");
  });

  it("only loaded beams can be unloaded; depleted beams cannot be loaded", async () => {
    const beam = await svc.produceBeam(newBeam);
    const err = await error(
      svc.unloadBeam({ beamId: beam.id, date: today, toStatus: "IN_STORE", rack: "", remark: "" }),
    );
    expect((err as WarpingValidationError).message).toMatch(/not loaded/);
    await svc.moveBeam({
      beamId: beam.id,
      date: today,
      toStatus: "DEPLETED",
      rack: "",
      remark: "",
    });
    const load = await error(
      svc.loadBeam({ beamId: beam.id, loomId: "mc-41", date: today, remark: "" }),
    );
    expect((load as WarpingValidationError).message).toMatch(/not in store/);
  });
});
