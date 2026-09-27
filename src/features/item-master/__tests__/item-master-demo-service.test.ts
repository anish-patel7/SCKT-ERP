import { beforeEach, describe, expect, it } from "vitest";
import { ItemMasterDemoService } from "@/features/item-master/demo/item-master-demo-service";
import { ItemValidationError } from "@/features/item-master/services/item-master-service";
import { cloneItemInput, emptyItemInput, toInput } from "@/features/item-master/utils/item-model";
import { DEMO_ITEM_LOOKUPS } from "@/features/masters/demo/item-lookups";

let svc: ItemMasterDemoService;
beforeEach(() => {
  svc = new ItemMasterDemoService();
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e,
  );
}

describe("ItemMasterDemoService", () => {
  it("lists fixtures with resolved names", async () => {
    const list = await svc.listItems();
    const sl02 = list.find((i) => i.code === "SL02");
    expect(sl02).toMatchObject({
      productName: "SL02-SALSA",
      productType: "Saree",
      category: "Saree",
      primaryUnit: "PCS",
      productStatus: "Active",
      recordStatus: "SAVED",
      origin: "fixture",
    });
  });

  it("Production item lookups come from the same fixtures", async () => {
    const list = await svc.listItems();
    for (const item of DEMO_ITEM_LOOKUPS) {
      expect(list.find((i) => i.id === item.id)?.code).toBe(item.code);
    }
  });

  it("saves a draft with only a name and assigns a demo code", async () => {
    const input = emptyItemInput();
    input.basic.productName = "Draft Item";
    const rec = await svc.saveDraft(input);
    expect(rec).toMatchObject({ recordStatus: "DRAFT", origin: "session" });
    expect(rec.code).toMatch(/^ITM\/\d{4}$/);
    expect((await svc.getItem(rec.id))?.basic.productName).toBe("Draft Item");
  });

  it("rejects an incomplete Save with field errors", async () => {
    const input = emptyItemInput();
    input.basic.productName = "Incomplete";
    const err = await rejection(svc.save(input));
    expect(err).toBeInstanceOf(ItemValidationError);
    expect((err as ItemValidationError).errors["basic.productTypeId"]).toBeDefined();
  });

  it("Save marks a draft SAVED and keeps its code", async () => {
    const input = emptyItemInput();
    input.basic.productName = "Complete";
    const draft = await svc.saveDraft(input);
    input.basic.productTypeId = "pt-saree";
    input.status.productStatusId = "ps-active";
    const saved = await svc.save(input, draft.id);
    expect(saved).toMatchObject({ id: draft.id, code: draft.code, recordStatus: "SAVED" });
  });

  it("returns copies, so callers cannot mutate the store", async () => {
    const rec = await svc.getItem("it-sl02");
    rec!.basic.productName = "changed";
    expect((await svc.getItem("it-sl02"))?.basic.productName).toBe("SL02-SALSA");
  });

  it("clone saves as a new item and leaves the source unchanged", async () => {
    const source = (await svc.getItem("it-sl02"))!;
    const clone = await svc.saveDraft(cloneItemInput(toInput(source)));
    expect(clone.id).not.toBe(source.id);
    expect(clone.basic.productName).toBe("Copy of SL02-SALSA");
    expect(clone.weft.lines).toHaveLength(source.weft.lines.length);
    expect((await svc.getItem("it-sl02"))?.basic.productName).toBe("SL02-SALSA");
  });

  it("deletes only session drafts", async () => {
    await expect(svc.deleteDraft("it-sl02")).rejects.toThrow(/Only drafts/);
    const input = emptyItemInput();
    input.basic.productName = "To delete";
    const draft = await svc.saveDraft(input);
    await svc.deleteDraft(draft.id);
    expect(await svc.getItem(draft.id)).toBeNull();

    input.basic.productTypeId = "pt-saree";
    input.status.productStatusId = "ps-active";
    const saved = await svc.save(input);
    await expect(svc.deleteDraft(saved.id)).rejects.toThrow(/Only drafts/);
  });
});
