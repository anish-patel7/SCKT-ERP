import fs from "node:fs";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const root = new URL("../../", import.meta.url);
const files = JSON.parse(
  fs.readFileSync(new URL("./reachable-files.json", import.meta.url)),
);
const columns = JSON.parse(
  execFileSync(
    "G:/PostgreSQL/18/bin/psql.exe",
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "55439",
      "-U",
      "postgres",
      "-d",
      "sckt_final",
      "-At",
      "-c",
      "SELECT json_object_agg(table_name,columns) FROM (SELECT table_name,json_agg(column_name) columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name) c",
    ],
    { encoding: "utf8" },
  ),
);
const refs = [],
  missing = [],
  unresolved = [];
function literal(n) {
  return n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    ? n.text
    : undefined;
}
function relation(node) {
  if (
    !node ||
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  )
    return undefined;
  if (node.expression.name.text === "from") return literal(node.arguments[0]);
  return relation(node.expression.expression);
}
for (const file of files) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(new URL(file, root), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text,
        table = relation(node),
        arg = literal(node.arguments[0]);
      if (table) {
        const location = {
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          table,
        };
        if (!columns[table]) missing.push({ ...location, kind: "table" });
        if (
          [
            "eq",
            "neq",
            "gt",
            "gte",
            "lt",
            "lte",
            "order",
            "in",
            "is",
            "ilike",
            "like",
          ].includes(method) &&
          arg &&
          !arg.includes(".")
        ) {
          refs.push({ ...location, column: arg });
          if (columns[table] && !columns[table].includes(arg))
            missing.push({ ...location, column: arg, kind: "column" });
        }
        if (method === "select" && arg && arg !== "*") {
          // Only validate simple column lists; nested relationship syntax needs FK analysis.
          if (/[():]/.test(arg)) unresolved.push({ ...location, select: arg });
          else
            for (const part of arg
              .split(",")
              .map((x) => x.trim())
              .filter((x) => x && x !== "*")) {
              refs.push({ ...location, column: part });
              if (columns[table] && !columns[table].includes(part))
                missing.push({ ...location, column: part, kind: "column" });
            }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const result = {
  checked_references: refs.length,
  missing,
  unresolved_nested_selects: unresolved,
  limitation:
    "Conservative route-module graph; dynamic payloads, builder variables and nested relation selects need separate review. Zero exhaustive missing-column claim is not made.",
};
fs.writeFileSync(
  new URL("./contract-results.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    {
      checked: refs.length,
      missing,
      unresolved_nested_selects: unresolved.length,
    },
    null,
    2,
  ),
);
