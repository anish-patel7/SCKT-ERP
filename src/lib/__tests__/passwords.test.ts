import { describe, expect, it } from "vitest";
import { generatePassword, validateNewPassword } from "@/lib/passwords";
import { CreateUserInputSchema } from "@/lib/validators/admin-users";

describe("generatePassword", () => {
  it("produces a 16-character password that passes server validation", () => {
    const password = generatePassword();
    expect(password).toHaveLength(16);
    expect(
      CreateUserInputSchema.safeParse({ email: "a@b.co", full_name: "A", password }).success,
    ).toBe(true);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(seen.size).toBe(50);
  });
});

describe("CreateUserInputSchema", () => {
  it("normalizes email and turns blank optional fields into null", () => {
    const parsed = CreateUserInputSchema.parse({
      email: " A@B.CO ",
      full_name: " Ann ",
      password: "12345678",
      department: "  ",
    });
    expect(parsed).toMatchObject({
      email: "a@b.co",
      full_name: "Ann",
      department: null,
      employee_id: null,
      role_ids: [],
    });
  });

  it("rejects bad email, empty name and short password", () => {
    const result = CreateUserInputSchema.safeParse({ email: "x", full_name: "", password: "1" });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "full_name", "password"]));
  });
});

describe("validateNewPassword", () => {
  it("requires 8+ characters and a matching confirmation", () => {
    expect(validateNewPassword("short", "short")).toMatch(/at least 8/);
    expect(validateNewPassword("long-enough", "different")).toBe("Passwords do not match");
    expect(validateNewPassword("long-enough", "long-enough")).toBeNull();
  });
});
