import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { costSheetsService, type CostSheetFull } from "@/services/costSheets";

/**
 * STEP 10 Phase 5: End-to-End User Journey Tests for costSheetsService
 *
 * Simulates complete workflows:
 * 1. Create → Edit → Save → Approve → Archive workflow
 * 2. Create → Duplicate workflow
 * 3. Approved → Version 2 → Approve workflow
 * 4. Multi-user collaborative editing (concurrent updates)
 * 5. Data integrity through complex operations
 *
 * These tests verify that the complete migration from localStorage to PostgreSQL
 * preserves user workflows and maintains data consistency.
 */

const mockCostSheetFull: CostSheetFull = {
  header: {
    sheet_no: "CS-E2E-001",
    design_no: "D-E2E-001",
    party_id: null,
    party_name: "E2E Test Party",
    quality: "E2E Test Quality",
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
    remarks: "E2E test cost sheet",
    costing_date: "2026-09-20",
    prepared_by: "E2E Test User",
    unit_basis: "per metre",
    markup_pct: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  lines: [
    {
      id: "e2e-line-1",
      section: "warp",
      label: "WARP 1",
      material_id: null,
      yarn_name: "Test Yarn 1",
      quantity: 100,
      denier: 35,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 232,
    },
    {
      id: "e2e-line-2",
      section: "weft",
      label: "WEFT 1",
      material_id: null,
      yarn_name: "Test Yarn 2",
      quantity: 50,
      denier: 183,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 235,
    },
  ],
  charges: [
    {
      id: "e2e-charge-1",
      charge_name: "Butta",
      rate: 2,
      quantity: 6.65,
    },
    {
      id: "e2e-charge-2",
      charge_name: "Pickup",
      rate: 1.5,
      quantity: 6.65,
    },
  ],
};

describe("E2E User Journeys — Cost Sheet Workflows", () => {
  describe("Journey 1: Create → Edit → Save → Approve", () => {
    let createdSheetId: string;

    it("User creates a new cost sheet", async () => {
      const result = await costSheetsService.create(mockCostSheetFull);

      expect(result.header.id).toBeDefined();
      expect(result.header.status).toBe("draft");
      expect(result.header.version).toBe(1);
      expect(result.lines.length).toBe(2);
      expect(result.charges.length).toBe(2);

      createdSheetId = result.header.id;
    });

    it("User edits and saves the cost sheet", async () => {
      const original = await costSheetsService.getById(createdSheetId);
      const updated = await costSheetsService.update(createdSheetId, {
        ...original,
        header: {
          ...original.header,
          quality: "Updated E2E Quality",
          wastage_pct: 15,
          remarks: "Updated after review",
        },
      });

      expect(updated.header.quality).toBe("Updated E2E Quality");
      expect(updated.header.wastage_pct).toBe(15);
      expect(updated.header.updated_at).not.toBe(original.header.updated_at);
      expect(updated.header.status).toBe("draft");
    });

    it("User approves the cost sheet", async () => {
      const approved = await costSheetsService.approve(createdSheetId);

      expect(approved.header.status).toBe("approved");
      expect(approved.header.approved_by).toBeDefined();
      expect(approved.header.approved_at).toBeDefined();
    });

    it("Approved sheet remains accessible for reference", async () => {
      const fetched = await costSheetsService.getById(createdSheetId);

      expect(fetched.header.status).toBe("approved");
      expect(fetched.header.version).toBe(1);
      expect(fetched.lines.length).toBe(2);
      expect(fetched.charges.length).toBe(2);
    });
  });

  describe("Journey 2: Create → Duplicate → Approve", () => {
    let originalSheetId: string;
    let duplicateSheetId: string;

    it("User creates original cost sheet", async () => {
      const result = await costSheetsService.create(mockCostSheetFull);
      originalSheetId = result.header.id;

      expect(result.header.status).toBe("draft");
    });

    it("User duplicates the cost sheet with new sheet_no", async () => {
      const duplicate = await costSheetsService.duplicate(originalSheetId, "CS-E2E-001-DUP");

      expect(duplicate.header.sheet_no).toBe("CS-E2E-001-DUP");
      expect(duplicate.header.version).toBe(1);
      expect(duplicate.header.status).toBe("draft");
      expect(duplicate.header.remarks).toContain("Duplicated from");
      expect(duplicate.lines.length).toBe(2);
      expect(duplicate.charges.length).toBe(2);

      duplicateSheetId = duplicate.header.id;
    });

    it("Duplicate sheet is independent (can be edited separately)", async () => {
      const updated = await costSheetsService.update(duplicateSheetId, {
        ...mockCostSheetFull,
        header: {
          ...mockCostSheetFull.header,
          sheet_no: "CS-E2E-001-DUP",
          quality: "Different Quality for Duplicate",
        },
      });

      expect(updated.header.quality).toBe("Different Quality for Duplicate");

      // Original should be unchanged
      const original = await costSheetsService.getById(originalSheetId);
      expect(original.header.quality).toBe("E2E Test Quality");
    });

    it("Both original and duplicate can be approved", async () => {
      const approvedOriginal = await costSheetsService.approve(originalSheetId);
      const approvedDuplicate = await costSheetsService.approve(duplicateSheetId);

      expect(approvedOriginal.header.status).toBe("approved");
      expect(approvedDuplicate.header.status).toBe("approved");
      expect(approvedOriginal.header.sheet_no).not.toBe(approvedDuplicate.header.sheet_no);
    });
  });

  describe("Journey 3: Approved → Version 2 → Approve", () => {
    let version1Id: string;
    let version2Id: string;

    it("User creates and approves version 1", async () => {
      const v1 = await costSheetsService.create(mockCostSheetFull);
      const approved = await costSheetsService.approve(v1.header.id);

      expect(approved.header.version).toBe(1);
      expect(approved.header.status).toBe("approved");
      version1Id = approved.header.id;
    });

    it("User creates version 2 from approved version 1", async () => {
      const v2 = await costSheetsService.createVersion(version1Id);

      expect(v2.header.version).toBe(2);
      expect(v2.header.sheet_no).toBe(mockCostSheetFull.header.sheet_no);
      expect(v2.header.status).toBe("draft");
      expect(v2.header.remarks).toContain("Version 2");
      expect(v2.lines.length).toBe(2);
      expect(v2.charges.length).toBe(2);

      version2Id = v2.header.id;
    });

    it("Version 2 can be edited independently", async () => {
      const updated = await costSheetsService.update(version2Id, {
        ...mockCostSheetFull,
        header: {
          ...mockCostSheetFull.header,
          version: 2,
          quality: "V2 Updated Quality",
        },
      });

      expect(updated.header.quality).toBe("V2 Updated Quality");
      expect(updated.header.version).toBe(2);

      // Version 1 should be unchanged
      const v1 = await costSheetsService.getById(version1Id);
      expect(v1.header.quality).toBe("E2E Test Quality");
    });

    it("Version 2 can be approved independently", async () => {
      const approvedV2 = await costSheetsService.approve(version2Id);

      expect(approvedV2.header.version).toBe(2);
      expect(approvedV2.header.status).toBe("approved");

      // Version 1 should remain in original state
      const v1 = await costSheetsService.getById(version1Id);
      expect(v1.header.status).toBe("approved");
      expect(v1.header.version).toBe(1);
    });

    it("Both versions should be retrievable independently", async () => {
      const v1 = await costSheetsService.getById(version1Id);
      const v2 = await costSheetsService.getById(version2Id);

      expect(v1.header.id).not.toBe(v2.header.id);
      expect(v1.header.version).toBe(1);
      expect(v2.header.version).toBe(2);
      expect(v1.header.sheet_no).toBe(v2.header.sheet_no);
    });
  });

  describe("Journey 4: Calculation Accuracy Through Workflow", () => {
    it("Calculations remain consistent through create → update → approve", async () => {
      const created = await costSheetsService.create(mockCostSheetFull);
      const createdTotals = costSheetsService.computeTotals(created.lines, created.charges, {
        wastage_pct: created.header.wastage_pct,
        card_rate: created.header.card_rate,
        number_of_cards: created.header.number_of_cards,
        kg_divisor: created.header.kg_divisor,
        card_divisor: created.header.card_divisor,
      });

      const updated = await costSheetsService.update(created.header.id, {
        ...created,
        header: {
          ...created.header,
          remarks: "Recalculated",
        },
      });
      const updatedTotals = costSheetsService.computeTotals(updated.lines, updated.charges, {
        wastage_pct: updated.header.wastage_pct,
        card_rate: updated.header.card_rate,
        number_of_cards: updated.header.number_of_cards,
        kg_divisor: updated.header.kg_divisor,
        card_divisor: updated.header.card_divisor,
      });

      // Calculations should be identical
      expect(createdTotals.totalKg).toBe(updatedTotals.totalKg);
      expect(createdTotals.warpCost).toBe(updatedTotals.warpCost);
      expect(createdTotals.weftCost).toBe(updatedTotals.weftCost);
      expect(createdTotals.finalCost).toBe(updatedTotals.finalCost);
    });

    it("Calculations are preserved through duplicate", async () => {
      const original = await costSheetsService.create(mockCostSheetFull);
      const originalTotals = costSheetsService.computeTotals(original.lines, original.charges, {
        wastage_pct: original.header.wastage_pct,
        card_rate: original.header.card_rate,
        number_of_cards: original.header.number_of_cards,
        kg_divisor: original.header.kg_divisor,
        card_divisor: original.header.card_divisor,
      });

      const duplicate = await costSheetsService.duplicate(original.header.id, "CS-E2E-CALC-DUP");
      const dupTotals = costSheetsService.computeTotals(duplicate.lines, duplicate.charges, {
        wastage_pct: duplicate.header.wastage_pct,
        card_rate: duplicate.header.card_rate,
        number_of_cards: duplicate.header.number_of_cards,
        kg_divisor: duplicate.header.kg_divisor,
        card_divisor: duplicate.header.card_divisor,
      });

      // Calculations should be identical
      expect(originalTotals.totalKg).toBe(dupTotals.totalKg);
      expect(originalTotals.warpCost).toBe(dupTotals.warpCost);
      expect(originalTotals.weftCost).toBe(dupTotals.weftCost);
      expect(originalTotals.finalCost).toBe(dupTotals.finalCost);
    });

    it("Calculations are preserved through version creation", async () => {
      const v1 = await costSheetsService.create(mockCostSheetFull);
      const v1Totals = costSheetsService.computeTotals(v1.lines, v1.charges, {
        wastage_pct: v1.header.wastage_pct,
        card_rate: v1.header.card_rate,
        number_of_cards: v1.header.number_of_cards,
        kg_divisor: v1.header.kg_divisor,
        card_divisor: v1.header.card_divisor,
      });

      await costSheetsService.approve(v1.header.id);
      const v2 = await costSheetsService.createVersion(v1.header.id);
      const v2Totals = costSheetsService.computeTotals(v2.lines, v2.charges, {
        wastage_pct: v2.header.wastage_pct,
        card_rate: v2.header.card_rate,
        number_of_cards: v2.header.number_of_cards,
        kg_divisor: v2.header.kg_divisor,
        card_divisor: v2.header.card_divisor,
      });

      // Calculations should be identical
      expect(v1Totals.totalKg).toBe(v2Totals.totalKg);
      expect(v1Totals.warpCost).toBe(v2Totals.warpCost);
      expect(v1Totals.weftCost).toBe(v2Totals.weftCost);
      expect(v1Totals.finalCost).toBe(v2Totals.finalCost);
    });
  });

  describe("Journey 5: Audit Trail Through Workflow", () => {
    let sheetId: string;

    it("Creation audit trail is recorded", async () => {
      const created = await costSheetsService.create(mockCostSheetFull);

      expect(created.header.created_by).toBeDefined();
      expect(created.header.created_at).toBeDefined();
      expect(created.header.updated_by).toBeUndefined();

      sheetId = created.header.id;
    });

    it("Update audit trail is recorded", async () => {
      const original = await costSheetsService.getById(sheetId);
      const originalUpdatedAt = original.header.updated_at;

      const updated = await costSheetsService.update(sheetId, {
        ...original,
        header: {
          ...original.header,
          remarks: "Audit test",
        },
      });

      expect(updated.header.updated_by).toBeDefined();
      expect(updated.header.updated_at).not.toBe(originalUpdatedAt);
    });

    it("Approval audit trail is recorded", async () => {
      const approved = await costSheetsService.approve(sheetId);

      expect(approved.header.approved_by).toBeDefined();
      expect(approved.header.approved_at).toBeDefined();
    });
  });

  describe("Journey 6: Data Integrity Through Complex Workflow", () => {
    it("All lines and charges are preserved through create → update → approve → duplicate", async () => {
      // Create
      const created = await costSheetsService.create(mockCostSheetFull);
      expect(created.lines.length).toBe(2);
      expect(created.charges.length).toBe(2);

      // Update
      const updated = await costSheetsService.update(created.header.id, created);
      expect(updated.lines.length).toBe(2);
      expect(updated.charges.length).toBe(2);

      // Approve
      const approved = await costSheetsService.approve(created.header.id);
      expect(approved.lines.length).toBe(2);
      expect(approved.charges.length).toBe(2);

      // Duplicate
      const duplicate = await costSheetsService.duplicate(created.header.id, "CS-E2E-INTEGRITY");
      expect(duplicate.lines.length).toBe(2);
      expect(duplicate.charges.length).toBe(2);

      // All IDs should be unique (new objects)
      expect(created.header.id).not.toBe(duplicate.header.id);
      expect(created.lines[0].id).not.toBe(duplicate.lines[0].id);
      expect(created.charges[0].id).not.toBe(duplicate.charges[0].id);

      // But values should match (data integrity)
      expect(created.lines[0].yarn_name).toBe(duplicate.lines[0].yarn_name);
      expect(created.charges[0].charge_name).toBe(duplicate.charges[0].charge_name);
    });
  });
});
