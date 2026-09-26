import { describe, it, expect } from "vitest";
import { z } from "zod";
import { formatServiceError, nextSequentialCode, toServiceError } from "../master-codes";
import { vi } from "vitest";

describe("nextSequentialCode", () => {
  it("starts at 01 when there are no codes", () => {
    expect(nextSequentialCode("Y-", [])).toBe("Y-01");
  });

  it("continues after the highest matching code and ignores other prefixes", () => {
    expect(nextSequentialCode("Y-", ["Y-01", "y-07", "X-99", "Y-ABC"])).toBe("Y-08");
    expect(nextSequentialCode("WH-", ["WH-09"])).toBe("WH-10");
    expect(nextSequentialCode("Y-", ["Y-99"])).toBe("Y-100");
  });
});

describe("formatServiceError", () => {
  it("turns an empty required string into a readable message", () => {
    const result = z.object({ code: z.string().min(1) }).safeParse({ code: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatServiceError(result.error)).toBe("Code is required");
  });

  it("labels other issues by field", () => {
    const result = z.object({ rate_per_kg: z.number() }).safeParse({ rate_per_kg: "x" });
    if (!result.success) {
      expect(formatServiceError(result.error)).toMatch(/^Rate Per Kg: /);
    }
  });

  it("passes plain errors through", () => {
    expect(formatServiceError(new Error("boom"))).toBe("boom");
  });
});

describe("toServiceError", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  it.each([
    [
      { code: "23505", message: "duplicate key" },
      "duplicate",
      "A yarn with this code already exists",
    ],
    [
      { code: "42501", message: "new row violates row-level security policy" },
      "permission",
      "You don't have permission to save this yarn",
    ],
    [
      { code: "PGRST116", message: "0 rows" },
      "permission",
      "This yarn was not found or you don't have permission to change it",
    ],
    [
      { message: "TypeError: Failed to fetch" },
      "network",
      "Network error: check your connection and try again",
    ],
    [{ code: "XX000", message: "internal detail" }, "database", "Database error while saving yarn"],
  ])("classifies %j", (backend, kind, message) => {
    const err = toServiceError(backend, "yarn");
    expect(err.kind).toBe(kind);
    expect(formatServiceError(err)).toBe(message);
    // Raw backend detail stays out of the user-facing message.
    expect(err.message).not.toContain("internal detail");
  });
});
