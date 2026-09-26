import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/integrations/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.fakeSupabase };
});

import {
  resetTables,
  tables,
  inserted,
  setBeforeNextInsert,
  SESSION_USER_ID,
} from "./fake-supabase";
import { warehousesService } from "../warehouses";
import { warehouseFormToPayload } from "@/components/master-form-payloads";
import { formatServiceError, ServiceError } from "@/lib/master-codes";

/** The create dialog's initial state (warehouse-master-view handleOpenCreate) plus user input. */
function newWarehouseForm(overrides: Record<string, unknown> = {}) {
  return {
    warehouse_code: "",
    warehouse_name: "Main Factory Warehouse",
    warehouse_type: "General",
    warehouse_type_other: "",
    address_line1: "",
    address_line2: "",
    area: "",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pincode: "395006",
    country: "India",
    contact_person: "",
    mobile: "",
    phone: "",
    email: "",
    remarks: "",
    status: "Active",
    ...overrides,
  };
}

describe("warehousesService create/edit/status", () => {
  beforeEach(() => resetTables());

  it("creates from the dialog state with a generated code and mapped fields", async () => {
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm(), false),
    );

    expect(saved.warehouse_code).toBe("WH-01");
    const row = inserted.warehouses[0]!;
    expect(row).toMatchObject({
      warehouse_code: "WH-01",
      warehouse_name: "Main Factory Warehouse",
      warehouse_type: "General",
      pin_code: "395006",
      city: "Surat",
      state: "Gujarat",
      status: "Active",
      is_active: true,
      created_by: SESSION_USER_ID,
      // Optional fields left blank are stored as NULL, not "".
      address_line1: null,
      email: null,
      remarks: null,
    });
    // UI-only / non-existent columns are not sent.
    expect(row).not.toHaveProperty("pincode");
    expect(row).not.toHaveProperty("phone");
  });

  it("allows address, city, state and pin code to be blank", async () => {
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm({ city: "", state: "", pincode: "" }), false),
    );
    expect(saved).toMatchObject({ city: null, state: null, pin_code: null });
  });

  it("saves Inactive with is_active=false and lists it only when inactive rows are included", async () => {
    await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm({ status: "Inactive" }), false),
    );
    expect(tables.warehouses[0]).toMatchObject({ status: "Inactive", is_active: false });
    expect(await warehousesService.listWarehouses(false)).toHaveLength(0);
    expect(await warehousesService.listWarehouses(true)).toHaveLength(1);
  });

  it("does not reuse the code of an inactive warehouse", async () => {
    tables.warehouses.push({ id: "old", warehouse_code: "WH-01", status: "Inactive" });
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm(), false),
    );
    expect(saved.warehouse_code).toBe("WH-02");
  });

  it("retries with a fresh code when a concurrent save takes the generated one", async () => {
    setBeforeNextInsert(() => {
      tables.warehouses.push({ id: "race", warehouse_code: "WH-01", status: "Active" });
    });
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm(), false),
    );
    expect(saved.warehouse_code).toBe("WH-02");
  });

  it("rejects a type the form does not offer, with a readable message", async () => {
    const err = await warehousesService
      .createWarehouse(
        warehouseFormToPayload(newWarehouseForm({ warehouse_type: "Moon Base" }), false),
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ZodError);
    expect(formatServiceError(err)).toBe("Warehouse Type is invalid");
  });

  it("edit keeps the code, maps pincode to pin_code and syncs is_active", async () => {
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm(), false),
    );
    // The edit dialog loads the row and exposes pin_code as pincode.
    const editForm = { ...saved, pincode: "395007", status: "Inactive" };
    const updated = await warehousesService.updateWarehouse(
      saved.id,
      warehouseFormToPayload(editForm, true),
    );
    expect(updated).toMatchObject({
      warehouse_code: "WH-01",
      pin_code: "395007",
      status: "Inactive",
      is_active: false,
    });
  });

  it("status toggle keeps status and is_active in sync", async () => {
    const saved = await warehousesService.createWarehouse(
      warehouseFormToPayload(newWarehouseForm(), false),
    );
    const updated = await warehousesService.setWarehouseStatus(saved.id, "Inactive");
    expect(updated).toMatchObject({ status: "Inactive", is_active: false });
  });

  it("classifies a supplied duplicate code", async () => {
    tables.warehouses.push({ id: "a", warehouse_code: "WH-05", status: "Active" });
    const err = await warehousesService
      .createWarehouse({
        ...warehouseFormToPayload(newWarehouseForm(), false),
        warehouse_code: "wh-05",
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).kind).toBe("duplicate");
  });
});
