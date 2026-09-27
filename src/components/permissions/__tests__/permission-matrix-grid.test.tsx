// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PermissionMatrixGrid } from "@/components/permissions/permission-matrix-grid";
import { buildPermissionMatrix } from "@/lib/permission-matrix";
import { CATALOG, idOf } from "@/lib/__tests__/permission-catalog.fixture";

const model = buildPermissionMatrix(CATALOG);

function renderGrid(overrides: Partial<Parameters<typeof PermissionMatrixGrid>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <PermissionMatrixGrid
      model={model}
      granted={new Set()}
      allGranted={false}
      editable
      onChange={onChange}
      {...overrides}
    />,
  );
  return onChange;
}

/** The desktop table (the mobile cards render the same checkboxes, hidden by CSS). */
function table() {
  return within(screen.getByRole("table"));
}

const isChecked = (el: HTMLElement) => el.getAttribute("aria-checked") === "true";
const isDisabled = (el: HTMLElement) => el.hasAttribute("disabled");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PermissionMatrixGrid", () => {
  it("renders one aligned header row with the standard columns plus SPECIAL", () => {
    renderGrid();
    const headerRow = table().getAllByRole("row")[0];
    if (!headerRow) throw new Error("header row missing");
    const headers = within(headerRow)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Resource / Function",
      "VIEW",
      "CREATE",
      "EDIT",
      "DELETE",
      "APPROVE",
      "SPECIAL",
    ]);
  });

  it("shows friendly labels with the permission module underneath", () => {
    renderGrid();
    const row = table().getByRole("rowheader", { name: /Users/ });
    expect(row.textContent).toContain("user_management");
  });

  it("distinguishes an unavailable action (—) from an unchecked permission", () => {
    renderGrid();
    const auditRow = table()
      .getByRole("rowheader", { name: /Audit History/ })
      .closest("tr");
    if (!auditRow) throw new Error("audit row missing");
    const row = within(auditRow);
    expect(row.getAllByRole("checkbox")).toHaveLength(1);
    expect(isChecked(row.getByRole("checkbox", { name: "Audit History — View" }))).toBe(false);
    expect(row.getAllByText("Not available")).toHaveLength(5); // CREATE..APPROVE + SPECIAL
  });

  it("gives every checkbox an accessible name and toggles one permission", () => {
    const onChange = renderGrid({ granted: new Set([idOf("sales:read")]) });
    expect(isChecked(table().getByRole("checkbox", { name: "Sales — View" }))).toBe(true);
    fireEvent.click(table().getByRole("checkbox", { name: "Sales — Create" }));
    expect(onChange).toHaveBeenCalledWith([idOf("sales:create")], true);
    fireEvent.click(table().getByRole("checkbox", { name: "Users — Assign roles" }));
    expect(onChange).toHaveBeenLastCalledWith([idOf("user_management:assign_role")], true);
  });

  it("locks every permission as granted for the Administrator", () => {
    renderGrid({ allGranted: true, editable: false });
    const boxes = table().getAllByRole("checkbox");
    expect(boxes.length).toBe(CATALOG.length - 4); // yarn_master duplicate hidden
    for (const box of boxes) {
      expect(isChecked(box)).toBe(true);
      expect(isDisabled(box)).toBe(true);
    }
    expect(table().queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("is read-only without edit rights", () => {
    renderGrid({ editable: false, granted: new Set([idOf("sales:read")]) });
    expect(isDisabled(table().getByRole("checkbox", { name: "Sales — View" }))).toBe(true);
    expect(table().queryByRole("button", { name: "Select all" })).toBeNull();
  });

  it("module bulk actions stay within the module", () => {
    const onChange = renderGrid();
    const salesHeader = table().getByRole("columnheader", { name: /^Sales/ });
    fireEvent.click(within(salesHeader).getByRole("button", { name: "All VIEW" }));
    expect(onChange).toHaveBeenLastCalledWith([idOf("sales:read")], true);
    fireEvent.click(within(salesHeader).getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(
      [idOf("sales:read"), idOf("sales:create"), idOf("sales:update")],
      false,
    );
  });

  it("asks for confirmation before granting all System permissions", () => {
    const onChange = renderGrid();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const systemHeader = table().getByRole("columnheader", { name: /^System/ });
    fireEvent.click(within(systemHeader).getByRole("button", { name: "Select all" }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(within(systemHeader).getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0]).toContain(idOf("role_management:assign_permissions"));
  });

  it("renders mobile cards with labelled rows for every action", () => {
    renderGrid();
    const mobile = within(screen.getByRole("region", { name: "Masters" }));
    expect(mobile.getByRole("checkbox", { name: "Yarn — Delete" })).toBeTruthy();
    expect(mobile.getAllByText("APPROVE").length).toBeGreaterThan(0);
  });
});
