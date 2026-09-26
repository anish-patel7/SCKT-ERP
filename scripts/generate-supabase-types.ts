#!/usr/bin/env node
/**
 * STEP 4A.1: Migration-Based Supabase Type Generator
 *
 * Generates TypeScript database types from Supabase migrations without requiring
 * Supabase CLI, Docker, or project credentials.
 *
 * Usage: npx tsx scripts/generate-supabase-types.ts
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Type Definitions
// ============================================================================

interface Column {
  name: string;
  sqlType: string;
  tsType: string;
  nullable: boolean;
  default?: string;
  references?: {
    table: string;
    column: string;
    onDelete?: string;
  };
}

interface TableDef {
  name: string;
  schema: string;
  columns: Map<string, Column>;
  primaryKey?: string;
  constraints: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface EnumDef {
  name: string;
  schema: string;
  values: string[];
}

// ============================================================================
// SQL Type to TypeScript Type Mapping
// ============================================================================

function mapSqlToTsType(sqlType: string): string {
  const normalized = sqlType.toLowerCase().trim();

  if (
    normalized.startsWith("varchar") ||
    normalized.startsWith("text") ||
    normalized === "character varying"
  ) {
    return "string";
  }
  if (normalized.startsWith("int") || normalized === "smallint" || normalized === "bigint") {
    return "number";
  }
  if (
    normalized.startsWith("numeric") ||
    normalized.startsWith("decimal") ||
    normalized === "float" ||
    normalized === "real"
  ) {
    return "number";
  }
  if (normalized.startsWith("boolean") || normalized === "bool") {
    return "boolean";
  }
  if (normalized.startsWith("timestamp") || normalized.startsWith("date")) {
    return "string";
  }
  if (normalized === "uuid") {
    return "string";
  }
  if (normalized === "json" || normalized === "jsonb") {
    return "Json";
  }
  if (normalized.startsWith("bytea")) {
    return "string";
  }

  // Handle schema-qualified types (e.g., public.app_role -> app_role)
  if (normalized.includes(".")) {
    const parts = normalized.split(".");
    return parts[parts.length - 1];
  }

  // For custom types/enums, return as-is (they'll be defined elsewhere)
  return normalized;
}

// ============================================================================
// Migration Parser
// ============================================================================

class MigrationParser {
  tables: Map<string, TableDef> = new Map();
  enums: Map<string, EnumDef> = new Map();
  rpcs: Map<string, string> = new Map();
  processedMigrations: string[] = [];

  parseMigration(filePath: string): void {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    try {
      this.parseSQL(content, filePath);
      this.processedMigrations.push(fileName);
    } catch (error) {
      throw new Error(
        `Failed to parse migration ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseSQL(content: string, filePath: string): void {
    // Remove comments
    const sql = this.removeComments(content);

    // Split by semicolon to get individual statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      if (statement.toUpperCase().startsWith("CREATE TABLE")) {
        this.parseCreateTable(statement);
      } else if (statement.toUpperCase().startsWith("ALTER TABLE")) {
        this.parseAlterTable(statement);
      } else if (statement.toUpperCase().startsWith("CREATE TYPE")) {
        this.parseCreateType(statement);
      } else if (statement.toUpperCase().startsWith("CREATE OR REPLACE FUNCTION")) {
        // For now, just track RPC presence - detailed parsing is complex
        const match = statement.match(/FUNCTION\s+public\.(\w+)/i);
        if (match) {
          this.rpcs.set(match[1], statement);
        }
      }
      // Ignore other statements (indexes, policies, triggers, etc.)
    }
  }

  private removeComments(sql: string): string {
    // Remove -- comments
    let result = sql.replace(/--[^\n]*/g, "");
    // Remove /* */ comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, "");
    return result;
  }

  private parseCreateTable(statement: string): void {
    // Extract table name: CREATE TABLE [IF NOT EXISTS] public.table_name
    const tableMatch = statement.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/i,
    );
    if (!tableMatch) {
      throw new Error("Could not extract table name from CREATE TABLE statement");
    }

    const tableName = tableMatch[1];
    const table: TableDef = {
      name: tableName,
      schema: "public",
      columns: new Map(),
      constraints: [],
    };

    // Extract column definitions (simplified parser)
    // This regex finds content within parentheses
    const contentMatch = statement.match(/\((.*)\)(?:\s*;)?$/s);
    if (!contentMatch) {
      throw new Error(`Could not extract column definitions for table ${tableName}`);
    }

    const content = contentMatch[1];
    const lines = content.split(",").map((l) => l.trim());

    for (const line of lines) {
      if (
        line.toUpperCase().startsWith("CONSTRAINT") ||
        line.toUpperCase().startsWith("PRIMARY KEY") ||
        line.toUpperCase().startsWith("FOREIGN KEY")
      ) {
        table.constraints.push(line);
        continue;
      }

      // Handle GENERATED ALWAYS AS (...) STORED columns
      if (line.toUpperCase().includes("GENERATED ALWAYS AS")) {
        const generatedMatch = line.match(/^(\w+)\s+GENERATED\s+ALWAYS\s+AS\s*\(/i);
        if (generatedMatch) {
          const columnName = generatedMatch[1];
          // For generated columns, infer type as number (most common case for computed columns)
          // This is a simplification - in reality, we'd need to parse the expression
          const column: Column = {
            name: columnName,
            sqlType: "numeric",
            tsType: "number",
            nullable: true, // Generated columns can be null
          };
          table.columns.set(columnName, column);
          continue;
        }
      }

      // Parse column definition: name TYPE [constraints]
      const colMatch = line.match(
        /^(\w+)\s+([^;\n]+?)(?:\s+(?:REFERENCES|NOT\s+NULL|NULL|DEFAULT|PRIMARY|UNIQUE|CHECK|CONSTRAINT|GENERATED)|\s*$)/i,
      );
      if (!colMatch) {
        // Skip if not a valid column definition
        continue;
      }

      const columnName = colMatch[1];
      const fullDef = line;

      // Extract type - take the second word after column name, handling schema-qualified and parameterized types
      const typeMatch = fullDef.match(/^\w+\s+((?:public\.)?\w+(?:\(\d+(?:,\s*\d+)?\))?)/i);
      if (!typeMatch) continue;

      const sqlType = typeMatch[1];
      const tsType = mapSqlToTsType(sqlType);

      // Check for DEFAULT clause
      const defaultMatch = fullDef.match(/DEFAULT\s+([^\s]+(?:\([^)]*\))?)/i);
      const defaultValue = defaultMatch ? defaultMatch[1] : undefined;

      // Check if nullable (default is nullable unless NOT NULL or PRIMARY KEY is specified)
      const isSql = fullDef.toUpperCase();
      const nullable = !isSql.includes("NOT NULL") && !isSql.includes("PRIMARY KEY");

      // Check for foreign key reference
      let references: Column["references"] | undefined;
      const refMatch = fullDef.match(
        /REFERENCES\s+(?:public\.)?(\w+)\s*\(\s*(\w+)\s*\)(?:\s+ON\s+DELETE\s+(\w+))?/i,
      );
      if (refMatch) {
        references = {
          table: refMatch[1],
          column: refMatch[2],
          onDelete: refMatch[3],
        };
      }

      const column: Column = {
        name: columnName,
        sqlType,
        tsType,
        nullable,
        default: defaultValue,
        references,
      };

      table.columns.set(columnName, column);

      // Track created_at/updated_at for metadata
      if (columnName === "created_at") {
        table.createdAt = columnName;
      }
      if (columnName === "updated_at") {
        table.updatedAt = columnName;
      }
    }

    if (table.columns.size === 0) {
      throw new Error(`No columns found for table ${tableName}`);
    }

    this.tables.set(tableName, table);
  }

  private parseAlterTable(statement: string): void {
    // Extract table name: ALTER TABLE [IF EXISTS] public.table_name
    const tableMatch = statement.match(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/i);
    if (!tableMatch) {
      return; // Skip if not parseable
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      // Table doesn't exist yet - create a placeholder (might be altered before created)
      this.tables.set(tableName, {
        name: tableName,
        schema: "public",
        columns: new Map(),
        constraints: [],
      });
      return;
    }

    // Extract ADD COLUMN clauses
    const addColMatch = statement.match(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+([^;]+?)(?=(?:ADD\s+COLUMN|;|$))/gi,
    );
    if (addColMatch) {
      for (const addCol of addColMatch) {
        const colDefMatch = addCol.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+(.+)/i);
        if (colDefMatch) {
          const columnName = colDefMatch[1];
          const fullDef = colDefMatch[2];

          // Extract type
          const typeMatch = fullDef.match(/^(\w+(?:\(\d+(?:,\s*\d+)?\))?)/i);
          if (!typeMatch) continue;

          const sqlType = typeMatch[1];
          const tsType = mapSqlToTsType(sqlType);
          const nullable = !fullDef.toUpperCase().includes("NOT NULL");

          const column: Column = {
            name: columnName,
            sqlType,
            tsType,
            nullable,
          };

          table.columns.set(columnName, column);
        }
      }
    }
  }

  private parseCreateType(statement: string): void {
    // Parse CREATE TYPE ... AS ENUM (...)
    const typeMatch = statement.match(/CREATE\s+TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM\s*\((.*)\)/i);
    if (!typeMatch) return;

    const enumName = typeMatch[1];
    const valuesStr = typeMatch[2];
    const values = valuesStr
      .split(",")
      .map((v) => v.trim())
      .map((v) => v.replace(/^['"]|['"]$/g, ""));

    this.enums.set(enumName, {
      name: enumName,
      schema: "public",
      values,
    });
  }
}

// ============================================================================
// Type Generator
// ============================================================================

class TypeGenerator {
  private parser: MigrationParser;

  constructor(parser: MigrationParser) {
    this.parser = parser;
  }

  generate(): string {
    const lines: string[] = [];

    // Header
    lines.push(
      "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
    );
    lines.push("");
    lines.push("export type Database = {");
    lines.push("  __InternalSupabase: {");
    lines.push('    PostgresVersion: "14.15";');
    lines.push("  };");
    lines.push("  public: {");
    lines.push("    Tables: {");

    // Tables
    for (const [tableName, table] of this.parser.tables) {
      lines.push(`      ${tableName}: {`);
      lines.push(this.generateTableTypes(table));
      lines.push("      };");
    }

    lines.push("    };");
    lines.push("    Views: {");
    lines.push("      [_ in never]: never;");
    lines.push("    };");
    lines.push("    Functions: {");

    // RPCs
    let hasRpcs = false;
    for (const [rpcName] of this.parser.rpcs) {
      if (!hasRpcs) {
        hasRpcs = true;
      }
      // For now, generate a minimal stub for RPCs
      lines.push(`      ${rpcName}: {`);
      lines.push("        Args: Record<string, unknown>;");
      lines.push("        Returns: unknown;");
      lines.push("      };");
    }

    if (!hasRpcs) {
      lines.push("      [_ in never]: never;");
    }

    lines.push("    };");
    lines.push("    Enums: {");

    // Enums
    if (this.parser.enums.size === 0) {
      lines.push("      [_ in never]: never;");
    } else {
      for (const [enumName, enumDef] of this.parser.enums) {
        const values = enumDef.values.map((v) => `"${v}"`).join(" | ");
        lines.push(`      ${enumName}: ${values};`);
      }
    }

    lines.push("    };");
    lines.push("    CompositeTypes: {");
    lines.push("      [_ in never]: never;");
    lines.push("    };");
    lines.push("  };");
    lines.push("};");
    lines.push("");
    lines.push('type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;');
    lines.push("");
    lines.push('type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];');
    lines.push("");

    // Type helpers (simplified versions)
    lines.push(`export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;`);

    lines.push("");
    lines.push(`export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;`);

    lines.push("");
    lines.push(`export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;`);

    lines.push("");
    lines.push(`export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;`);

    lines.push("");
    lines.push(`export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;`);

    lines.push("");
    lines.push("export const Constants = {");
    lines.push("  public: {");
    lines.push("    Enums: {");

    for (const [enumName, enumDef] of this.parser.enums) {
      const values = enumDef.values.map((v) => `"${v}"`).join(", ");
      lines.push(`      ${enumName}: [${values}],`);
    }

    lines.push("    },");
    lines.push("  },");
    lines.push("} as const;");
    lines.push("");

    return lines.join("\n");
  }

  private generateTableTypes(table: TableDef): string {
    const lines: string[] = [];

    // Row type
    lines.push("        Row: {");
    for (const [, col] of table.columns) {
      const tsType = this.getEnumTypeRef(col.tsType);
      const nullable = col.nullable ? " | null" : "";
      lines.push(`          ${col.name}: ${tsType}${nullable};`);
    }
    lines.push("        };");

    // Insert type
    lines.push("        Insert: {");
    for (const [, col] of table.columns) {
      const tsType = this.getEnumTypeRef(col.tsType);
      const optional = col.nullable || col.default ? "?" : "";
      const nullable = col.nullable ? " | null" : "";
      lines.push(`          ${col.name}${optional}: ${tsType}${nullable};`);
    }
    lines.push("        };");

    // Update type
    lines.push("        Update: {");
    for (const [, col] of table.columns) {
      const tsType = this.getEnumTypeRef(col.tsType);
      const nullable = col.nullable ? " | null" : "";
      lines.push(`          ${col.name}?: ${tsType}${nullable};`);
    }
    lines.push("        };");

    // Relationships (simplified - would need more complex analysis)
    lines.push("        Relationships: [");
    let relationshipCount = 0;
    for (const [, col] of table.columns) {
      if (col.references) {
        lines.push("          {");
        lines.push(`            foreignKeyName: "${table.name}_${col.name}_fkey";`);
        lines.push(`            columns: ["${col.name}"];`);
        lines.push("            isOneToOne: false;");
        lines.push(`            referencedRelation: "${col.references.table}";`);
        lines.push(`            referencedColumns: ["${col.references.column}"];`);
        lines.push("          },");
        relationshipCount++;
      }
    }
    lines.push("        ];");

    return lines.map((l) => "        " + l).join("\n");
  }

  private getEnumTypeRef(tsType: string): string {
    // Check if this type is a known enum
    if (this.parser.enums.has(tsType)) {
      return `Database["public"]["Enums"]["${tsType}"]`;
    }
    return tsType;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const outputPath = path.join(process.cwd(), "src", "integrations", "supabase", "types.ts");

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  console.log("🔍 Parsing migrations...");
  const parser = new MigrationParser();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`   Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    try {
      parser.parseMigration(filePath);
      console.log(`   ✓ ${file}`);
    } catch (error) {
      console.error(`   ✗ ${file}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  console.log("");
  console.log(`📊 Statistics:`);
  console.log(`   Tables: ${parser.tables.size}`);
  console.log(`   Enums: ${parser.enums.size}`);
  console.log(`   RPCs: ${parser.rpcs.size}`);

  console.log("");
  console.log("✍️  Generating types...");
  const generator = new TypeGenerator(parser);
  const typeCode = generator.generate();

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, typeCode);
  console.log(`   ✓ Generated ${outputPath}`);

  console.log("");
  console.log("✅ Type generation complete!");
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
