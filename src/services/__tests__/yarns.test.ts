import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/integrations/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.fakeSupabase };
});

import { resetTables, tables, inserted, SESSION_USER_ID } from "./fake-supabase";
import { yarnsService } from "../yarns";
import { yarnFormToPayload } from "@/components/master-form-payloads";
import { formatServiceError, ServiceError } from "@/lib/master-codes";

const manualExample = {
  name: "90/24 NYLON TPM-S",
  denier: "90",
  rate_per_kg: "305",
  remark: "Preferred supplier, special quality specs",
  status: "Active",
};

describe("yarnsService create/edit/status (materials)", () => {
  beforeEach(() => resetTables());

  it("creates the manual example with a generated code and canonical fields", async () => {
    const saved = await yarnsService.create(yarnFormToPayload(manualExample));

    expect(saved.code).toBe("Y-01");
    expect(saved).toMatchObject({
      name: "90/24 NYLON TPM-S",
      denier: 90,
      rate_per_kg: 305,
      remarks: "Preferred supplier, special quality specs",
      active: true,
    });
    // The insert used the table's columns only: no stale remark/status keys.
    const row = inserted.materials[0]!;
    expect(row).not.toHaveProperty("remark");
    expect(row).not.toHaveProperty("status");
    expect(row["created_by"]).toBe(SESSION_USER_ID);

    // Re-query (what a reload does) returns the same data.
    const [reloaded] = await yarnsService.list();
    expect(reloaded).toMatchObject({ code: "Y-01", remarks: saved.remarks, active: true });
  });

  it("assigns sequential codes after existing rows and never sends an empty code", async () => {
    tables.materials.push({ id: "old-1", code: "Y-07", name: "Legacy", active: true });
    tables.materials.push({ id: "old-2", code: "NYLON-A", name: "Other scheme", active: true });

    const first = await yarnsService.create(yarnFormToPayload(manualExample));
    const second = await yarnsService.create(yarnFormToPayload({ ...manualExample, name: "B" }));

    expect([first.code, second.code]).toEqual(["Y-08", "Y-09"]);
    // Existing codes are left untouched.
    expect(tables.materials.map((r) => r["code"])).toEqual(["Y-07", "NYLON-A", "Y-08", "Y-09"]);
  });

  it("ignores a blank caller code and generates one", async () => {
    const saved = await yarnsService.create({ ...yarnFormToPayload(manualExample), code: "" });
    expect(saved.code).toBe("Y-01");
  });

  it("saves Inactive as active=false and filters by the active flag", async () => {
    await yarnsService.create(yarnFormToPayload(manualExample));
    const inactive = await yarnsService.create(
      yarnFormToPayload({ ...manualExample, name: "OLD YARN", status: "Inactive" }),
    );
    expect(inactive.active).toBe(false);

    expect((await yarnsService.list({ active: false })).map((y) => y.name)).toEqual(["OLD YARN"]);
    expect((await yarnsService.list({ active: true })).map((y) => y.name)).toEqual([
      "90/24 NYLON TPM-S",
    ]);
  });

  it("status toggle writes a boolean", async () => {
    const saved = await yarnsService.create(yarnFormToPayload(manualExample));
    const toggled = await yarnsService.setStatus(saved.id!, false);
    expect(toggled.active).toBe(false);
    expect(typeof tables.materials[0]!["active"]).toBe("boolean");
  });

  it("edit keeps the code and updates remarks/active/numbers", async () => {
    const saved = await yarnsService.create(yarnFormToPayload(manualExample));
    const updated = await yarnsService.update(
      saved.id!,
      yarnFormToPayload({
        ...manualExample,
        denier: "",
        rate_per_kg: "310.5",
        remark: "",
        status: "Inactive",
      }),
    );
    expect(updated).toMatchObject({
      code: "Y-01",
      denier: null,
      rate_per_kg: 310.5,
      remarks: null,
      active: false,
    });
  });

  it("rejects a supplied duplicate code, matching literally and case-insensitively", async () => {
    tables.materials.push({ id: "x", code: "Y-01", name: "Existing", active: true });
    const err = await yarnsService
      .create({ ...yarnFormToPayload(manualExample), code: "y-01" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).kind).toBe("duplicate");

    // "_" is not a wildcard: "Y_01" must not collide with "Y-01".
    const ok = await yarnsService.create({ ...yarnFormToPayload(manualExample), code: "Y_01" });
    expect(ok.code).toBe("Y_01");
  });

  it("reports a missing name readably instead of raw Zod JSON", async () => {
    const err = await yarnsService
      .create(yarnFormToPayload({ ...manualExample, name: "  " }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ZodError);
    expect(formatServiceError(err)).toBe("Name is required");
    expect(inserted.materials).toHaveLength(0);
  });
});
