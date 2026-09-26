#!/usr/bin/env node
/**
 * Validate that generated Supabase types are correct
 */

import * as fs from "fs";
import * as path from "path";

const typesPath = path.join(process.cwd(), "src", "integrations", "supabase", "types.ts");

// Required canonical tables that MUST be in the generated types
const requiredTables = [
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

const content = fs.readFileSync(typesPath, "utf-8");
const errors: string[] = [];

console.log("🔍 Validating generated Supabase types...");
console.log("");

// Check for basic structure
if (!content.includes("export type Database = {")) {
  errors.push('Missing "export type Database" definition');
}

if (!content.includes("Tables: {")) {
  errors.push('Missing "Tables" definition');
}

if (!content.includes("Row: {")) {
  errors.push('Missing "Row" type definition');
}

if (!content.includes("Insert: {")) {
  errors.push('Missing "Insert" type definition');
}

if (!content.includes("Update: {")) {
  errors.push('Missing "Update" type definition');
}

// Check for required canonical tables
console.log("Checking for required canonical tables...");
for (const table of requiredTables) {
  if (content.includes(`${table}: {`)) {
    console.log(`  ✓ ${table}`);
  } else {
    errors.push(`Missing required table: ${table}`);
    console.log(`  ✗ ${table}`);
  }
}

console.log("");

// Check for enum support
if (content.includes("Enums: {")) {
  console.log("✓ Enum definitions present");
} else {
  errors.push("Missing Enums definition");
}

if (content.includes("app_role")) {
  console.log("✓ app_role enum found");
} else {
  errors.push("Missing app_role enum");
}

console.log("");

// Count tables
const tableMatches = content.match(/\w+: \{\s*Row:/g) || [];
console.log(`📊 Generated ${tableMatches.length} tables`);

// Check for enum type references
if (content.includes('Database["public"]["Enums"]')) {
  console.log("✓ Proper enum type references");
} else {
  errors.push("Invalid enum type references");
}

console.log("");

if (errors.length === 0) {
  console.log("✅ All validations passed!");
  process.exit(0);
} else {
  console.log("❌ Validation failed:");
  for (const error of errors) {
    console.log(`   - ${error}`);
  }
  process.exit(1);
}
