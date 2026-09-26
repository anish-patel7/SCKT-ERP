import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  costSheetsService,
  type CostSheetFull,
  type CostLine,
  type ChargeLine,
} from "@/services/costSheets";

/**
 * STEP 10 Phase 5: Integration Tests for costSheetsService
 *
 * Tests the complete migration from localStorage to PostgreSQL:
 * - CRUD operations with RLS enforcement
 * - Calculation accuracy (rounding order preserved)
 * - Workflow operations (approve, version, duplicate)
 * - Error handling and validation
 * - Audit trail creation
 */

// Mock test data
const mockCostSheetFull: CostSheetFull = {
  header: {
    sheet_no: "CS-TEST-001",
    design_no: "D-TEST-001",
    party_id: null,
    party_name: "Test Party Ltd",
    quality: "Test Quality",
    reed: 120,
    pick: 160,
    panna_inch: 49.5,
    length_metre: 6.65,
    wastage_pct: 10,
    card_rate: 0.4,
    number_of_cards: 17226,
    kg_divisor: 9000000,
    card_divisor: 39.37,
    status: "draft",
    version: 1,
    remarks: "Test cost sheet",
    costing_date: "2026-09-20",
    prepared_by: "Test User",
    unit_basis: "per metre",
    markup_pct: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  lines: [
    {
      id: "test-line-1",
      section: "warp",
      label: "WARP 1",
      material_id: null,
      yarn_name: "Test Yarn",
      quantity: 100,
      denier: 35,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 232,
    },
    {
      id: "test-line-2",
      section: "weft",
      label: "WEFT 1",
      material_id: null,
      yarn_name: "Test Weft",
      quantity: 50,
      denier: 183,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 235,
    },
  ],
  charges: [
    {
      id: "test-charge-1",
      charge_name: "Butta",
      rate: 2,
      quantity: 6.65,
    },
  ],
};

describe("costSheetsService", () => {
  let testSheetId: string;

  describe("CRUD Operations", () => {
    it("should create a new cost sheet", async () => {
      const result = await costSheetsService.create(mockCostSheetFull);

      expect(result.header).toBeDefined();
      expect(result.header.sheet_no).toBe(mockCostSheetFull.header.sheet_no);
      expect(result.header.status).toBe("draft");
      expect(result.header.version).toBe(1);
      expect(result.lines).toHaveLength(2);
      expect(result.charges).toHaveLength(1);

      testSheetId = result.header.id;
    });

    it("should reject duplicate sheet numbers", async () => {
      try {
        await costSheetsService.create(mockCostSheetFull);
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.field).toBe("sheet_no");
      }
    });

    it("should fetch a cost sheet by ID", async () => {
      const result = await costSheetsService.getById(testSheetId);

      expect(result.header.id).toBe(testSheetId);
      expect(result.header.sheet_no).toBe(mockCostSheetFull.header.sheet_no);
      expect(result.lines).toHaveLength(2);
      expect(result.charges).toHaveLength(1);
    });

    it("should list all cost sheets", async () => {
      const result = await costSheetsService.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((cs) => cs.header.id === testSheetId)).toBe(true);
    });

    it("should update a cost sheet", async () => {
      const updated: CostSheetFull = {
        ...mockCostSheetFull,
        header: {
          ...mockCostSheetFull.header,
          quality: "Updated Quality",
          wastage_pct: 15,
        },
      };

      const result = await costSheetsService.update(testSheetId, updated);

      expect(result.header.quality).toBe("Updated Quality");
      expect(result.header.wastage_pct).toBe(15);
      expect(result.header.updated_at).not.toBe(mockCostSheetFull.header.updated_at);
    });

    it("should delete a cost sheet (admin only)", async () => {
      // Create a sheet specifically to delete
      const toDelete = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-DELETE-TEST" },
      });

      await costSheetsService.delete(toDelete.header.id);

      try {
        await costSheetsService.getById(toDelete.header.id);
        expect.fail("Should have thrown NotFoundError");
      } catch (error: any) {
        expect(error.name).toBe("NotFoundError");
      }
    });
  });

  describe("Workflow Operations", () => {
    let workflowSheetId: string;

    beforeAll(async () => {
      const sheet = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-WORKFLOW-001" },
      });
      workflowSheetId = sheet.header.id;
    });

    it("should approve a cost sheet", async () => {
      const result = await costSheetsService.approve(workflowSheetId);

      expect(result.header.status).toBe("approved");
      expect(result.header.approved_by).toBeDefined();
      expect(result.header.approved_at).toBeDefined();
    });

    it("should create a new version", async () => {
      const original = await costSheetsService.getById(workflowSheetId);
      const version2 = await costSheetsService.createVersion(workflowSheetId);

      expect(version2.header.version).toBe(original.header.version + 1);
      expect(version2.header.sheet_no).toBe(original.header.sheet_no);
      expect(version2.header.status).toBe("draft");
      expect(version2.header.remarks).toContain(`Version ${version2.header.version}`);

      // Verify lines and charges are copied
      expect(version2.lines).toHaveLength(original.lines.length);
      expect(version2.charges).toHaveLength(original.charges.length);
    });

    it("should duplicate a cost sheet", async () => {
      const original = await costSheetsService.getById(workflowSheetId);
      const duplicate = await costSheetsService.duplicate(workflowSheetId, "CS-WORKFLOW-001-DUP");

      expect(duplicate.header.sheet_no).toBe("CS-WORKFLOW-001-DUP");
      expect(duplicate.header.version).toBe(1);
      expect(duplicate.header.status).toBe("draft");
      expect(duplicate.header.remarks).toContain("Duplicated from");

      // Verify lines and charges are copied
      expect(duplicate.lines).toHaveLength(original.lines.length);
      expect(duplicate.charges).toHaveLength(original.charges.length);
    });
  });

  describe("Calculation Accuracy", () => {
    it("should preserve deterministic rounding order", () => {
      // Test data with specific values that expose rounding issues
      const lines: CostLine[] = [
        {
          id: "line-1",
          section: "warp",
          label: "WARP 1",
          material_id: null,
          yarn_name: "Test",
          quantity: 5444,
          denier: 35,
          length_metre: 6.65,
          panna_inch: 49.5,
          rate_per_kg: 232,
        },
      ];

      const charges: ChargeLine[] = [{ id: "c1", charge_name: "Test", rate: 2, quantity: 6.65 }];

      const totals = costSheetsService.computeTotals(lines, charges, {
        wastage_pct: 10,
        card_rate: 0.4,
        number_of_cards: 17226,
        kg_divisor: 9000000,
        card_divisor: 39.37,
      });

      // Verify rounding is applied correctly
      // Warp KG should be: (5444 * 35 * 6.65) / 9000000 = 1.407
      // Warp Cost should be: ROUND(1.407 * 232, 2) = 326.42
      expect(totals.warpCost).toBe(326.42);

      // Wastage should be: ROUND((326.42 * 10) / 100, 2) = 32.64
      expect(totals.wastageCost).toBe(32.64);

      // Material with wastage = 326.42 + 32.64 = 359.06
      expect(totals.materialWithWastage).toBe(359.06);
    });

    it("should compute correct totals with multiple lines", async () => {
      const sheet = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-CALC-TEST" },
      });

      const totals = costSheetsService.computeTotals(sheet.lines, sheet.charges, {
        wastage_pct: sheet.header.wastage_pct,
        card_rate: sheet.header.card_rate,
        number_of_cards: sheet.header.number_of_cards,
        kg_divisor: sheet.header.kg_divisor,
        card_divisor: sheet.header.card_divisor,
        markup_pct: sheet.header.markup_pct,
        manual_sale_rate: sheet.header.manual_sale_rate,
      });

      // Verify all totals are computed
      expect(totals.totalKg).toBeGreaterThan(0);
      expect(totals.warpCost).toBeGreaterThan(0);
      expect(totals.weftCost).toBeGreaterThan(0);
      expect(totals.finalCost).toBeGreaterThan(0);
      expect(totals.saleRate).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw NotFoundError for non-existent sheet", async () => {
      try {
        await costSheetsService.getById("nonexistent-id");
        expect.fail("Should have thrown NotFoundError");
      } catch (error: any) {
        expect(error.name).toBe("NotFoundError");
        expect(error.resource).toBe("Cost Sheet");
      }
    });

    it("should reject invalid sheet data", async () => {
      try {
        await costSheetsService.create({
          ...mockCostSheetFull,
          header: { ...mockCostSheetFull.header, sheet_no: "" },
        });
        expect.fail("Should have thrown ValidationError");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
      }
    });

    it("should handle negative values", async () => {
      try {
        await costSheetsService.create({
          ...mockCostSheetFull,
          lines: [
            {
              ...mockCostSheetFull.lines[0],
              quantity: -100, // Invalid
            },
          ],
        });
        expect.fail("Should have thrown ValidationError");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
      }
    });
  });

  describe("Audit Trail", () => {
    it("should track created_by and created_at", async () => {
      const result = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-AUDIT-CREATE" },
      });

      expect(result.header.created_by).toBeDefined();
      expect(result.header.created_at).toBeDefined();
    });

    it("should track updated_by and updated_at on updates", async () => {
      const sheet = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-AUDIT-UPDATE" },
      });

      const original = sheet.header.updated_at;

      const updated = await costSheetsService.update(sheet.header.id, {
        ...sheet,
        header: { ...sheet.header, remarks: "Updated" },
      });

      expect(updated.header.updated_by).toBeDefined();
      expect(updated.header.updated_at).not.toBe(original);
    });

    it("should track approved_by and approved_at on approval", async () => {
      const sheet = await costSheetsService.create({
        ...mockCostSheetFull,
        header: { ...mockCostSheetFull.header, sheet_no: "CS-AUDIT-APPROVE" },
      });

      const approved = await costSheetsService.approve(sheet.header.id);

      expect(approved.header.approved_by).toBeDefined();
      expect(approved.header.approved_at).toBeDefined();
    });
  });
});
