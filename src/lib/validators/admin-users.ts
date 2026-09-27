import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

/** Input for the server-side Admin "Add User" action (validated on client and server). */
export const CreateUserInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  password: z
    .string()
    .min(8, "Initial password must be at least 8 characters")
    .max(72, "Initial password must be at most 72 characters"),
  employee_id: optionalText(50),
  department: optionalText(100),
  designation: optionalText(100),
  mobile: optionalText(20),
  /** First entry becomes the primary role. Requires user_management:assign_role. */
  role_ids: z.array(z.string().uuid()).max(20).default([]),
});

export type CreateUserInput = z.input<typeof CreateUserInputSchema>;
export type ValidCreateUserInput = z.output<typeof CreateUserInputSchema>;

export const CreatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  status: z.string(),
  approval_status: z.string(),
  role_ids: z.array(z.string().uuid()),
});

export type CreatedUser = z.infer<typeof CreatedUserSchema>;
