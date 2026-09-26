import { ZodError } from "zod";

/**
 * Next sequential master code for a prefix, e.g. "Y-" + ["Y-01", "Y-07", "X-99"] -> "Y-08".
 * Codes that don't match `<prefix><digits>` are ignored; numbers are zero-padded to `pad`.
 */
export function nextSequentialCode(prefix: string, existing: readonly string[], pad = 2): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i");
  let max = 0;
  for (const code of existing) {
    const match = pattern.exec(code.trim());
    const n = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

/** Escape LIKE/ILIKE wildcards so a code is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type ServiceErrorKind = "validation" | "duplicate" | "permission" | "network" | "database";

/** A save/load failure classified for the UI; the raw backend error stays in `cause` and the logs. */
export class ServiceError extends Error {
  constructor(
    public kind: ServiceErrorKind,
    message: string,
    public field?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ServiceError";
  }
}

interface BackendError {
  code?: string;
  message?: string;
}

function isNetworkFailure(error: unknown): boolean {
  // supabase-js reports fetch failures as plain { message } objects, not Error instances.
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

/**
 * Classify a Supabase/PostgREST error. `entity` is the record name used in messages, e.g. "yarn".
 * PGRST116 on a write means zero rows came back: the row is gone or RLS hid it from this user.
 */
export function toServiceError(error: BackendError, entity: string): ServiceError {
  const code = error.code ?? "";
  const raw = error.message ?? "";
  console.error(`[${entity}] backend error`, error);

  if (code === "23505") {
    return new ServiceError("duplicate", `A ${entity} with this code already exists`, "code", {
      cause: error,
    });
  }
  if (code === "42501" || /row-level security|permission denied/i.test(raw)) {
    return new ServiceError(
      "permission",
      `You don't have permission to save this ${entity}`,
      undefined,
      {
        cause: error,
      },
    );
  }
  if (code === "PGRST116") {
    return new ServiceError(
      "permission",
      `This ${entity} was not found or you don't have permission to change it`,
      undefined,
      { cause: error },
    );
  }
  if (code === "23502" || code === "23514" || code === "22P02" || code === "22001") {
    return new ServiceError(
      "validation",
      `Some ${entity} values were rejected by the database`,
      undefined,
      {
        cause: error,
      },
    );
  }
  if (isNetworkFailure(error)) {
    return new ServiceError(
      "network",
      "Network error: check your connection and try again",
      undefined,
      {
        cause: error,
      },
    );
  }
  return new ServiceError("database", `Database error while saving ${entity}`, undefined, {
    cause: error,
  });
}

function fieldLabel(path: ReadonlyArray<string | number>): string {
  const key = String(path[path.length - 1] ?? "value");
  return key
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Human-readable message for a service error; Zod issues become "Field is required" style lines. */
export function formatServiceError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const label = fieldLabel(issue.path);
        if (issue.code === "too_small" && issue.type === "string" && issue.minimum === 1) {
          return `${label} is required`;
        }
        if (issue.code === "invalid_enum_value") return `${label} is invalid`;
        return `${label}: ${issue.message}`;
      })
      .join("; ");
  }
  if (error instanceof ServiceError) return error.message;
  if (isNetworkFailure(error)) return "Network error: check your connection and try again";
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
