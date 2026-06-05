import { z } from "zod";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const emailSchema = z
  .email("Invalid email address")
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(255, "Email is too long");

export const registerSchema = z
  .object({
    email: emailSchema,

    password: z
      .string("Password is required")
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must be at most 64 characters")
      .regex(
        passwordRegex,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),

    confirmPassword: z.string("Confirm password is requried"),

    otp: z
      .string("OTP is required")
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must be numeric"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/** Schema gán role (admin only) */
export const updateRoleSchema = z.object({
  role: z.enum(["AUDIENCE", "ORGANIZER", "CHECKER", "ADMIN"] as const, {
    message: "role must be one of AUDIENCE, ORGANIZER, CHECKER, ADMIN",
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
