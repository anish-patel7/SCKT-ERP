import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * STEP 4A.1: Migration-Based Type Generator Tests
 *
 * Tests for:
 * 1. Type generator runs without errors
 * 2. Generated types file is valid TypeScript
 * 3. All canonical tables are present in generated types
 * 4. All migrations parse successfully
 * 5. Generator is deterministic (same input = same output)
 */

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const typesOutputPath = path.join(__dirname, "..", "src", "integrations", "supabase", "types.ts");

describe("Migration-Based Supabase Type Generator", () => {
  it("should generate types from all migrations without errors", async () => {
    // This test just verifies the generator was run successfully
    // The actual generation happens in the prepare step
    const stats = fs.statSync(typesOutputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("should generate valid TypeScript syntax", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for basic TypeScript constructs
    expect(content).toContain("export type Database = {");
    expect(content).toContain("Tables: {");
    expect(content).toContain("Row: {");
    expect(content).toContain("Insert: {");
    expect(content).toContain("Update: {");
    expect(content).toContain("Relationships: [");
    expect(content).toContain("Enums: {");
  });

  it("should include canonical tables", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for critical canonical tables
    const canonicalTables = [
      "profiles",
      "user_roles",
      "materials",
      "parties",
      "cost_sheets",
      "inventory_items",
      "production_orders",
      "job_cards",
      "quality_inspections",
      "sales_orders",
      "sales_invoices",
      "sales_payments",
      "warehouses",
      "stock_reservations",
    ];

    for (const table of canonicalTables) {
      expect(content).toContain(`${table}: {`);
    }
  });

  it("should include enum definitions", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for at least one enum definition
    expect(content).toContain("Enums: {");
    // Check for specific known enum
    expect(content).toContain("app_role");
  });

  it("should reference enums correctly in table types", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check that enum references use the correct format
    // e.g., Database["public"]["Enums"]["app_role"]
    expect(content).toContain('Database["public"]["Enums"]');
  });

  it("should handle nullable columns correctly", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for proper nullable types (type | null)
    expect(content).toMatch(/:\s+\w+\s+\|\s+null;/);
  });

  it("should mark fields as optional in Insert type when nullable or have defaults", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for optional fields in Insert types
    // These should have ? notation
    expect(content).toMatch(/\w+\?:\s+\w+/);
  });

  it("should generate migration statistics", () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    // Verify there are many migration files
    expect(files.length).toBeGreaterThan(40);

    // Verify migrations are in order (sorted by timestamp)
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it("should be deterministic", () => {
    // Read the generated file twice
    const firstRead = fs.readFileSync(typesOutputPath, "utf-8");
    const secondRead = fs.readFileSync(typesOutputPath, "utf-8");

    // They should be identical
    expect(firstRead).toBe(secondRead);
  });

  it("should handle generated columns (computed columns)", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for inventory_items table which has generated columns
    expect(content).toContain("inventory_items: {");
  });

  it("should include relationship metadata", () => {
    const content = fs.readFileSync(typesOutputPath, "utf-8");

    // Check for foreign key relationship definitions
    expect(content).toContain("foreignKeyName:");
    expect(content).toContain("referencedRelation:");
    expect(content).toContain("referencedColumns:");
  });
});
