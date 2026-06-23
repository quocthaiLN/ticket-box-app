import { z } from "zod";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(255, "Email is too long")
  .email("Invalid email address");

export const requestOtpSchema = z.object({
  email: emailSchema,
});

export const registerSchema = z
  .object({
    email: emailSchema,

    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must be at most 64 characters")
      .regex(
        passwordRegex,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),

    confirmPassword: z.string({
      required_error: "Confirm password is required",
    }),

    full_name: z
      .string({ required_error: "Full name is required" })
      .min(1, "Full name is required")
      .max(255, "Full name is too long"),

    otp: z
      .string({ required_error: "OTP is required" })
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only digits"),
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
  role: z.enum(["AUDIENCE", "ORGANIZER", "CHECKER", "ADMIN"] as const),
});

/** Schema đổi role theo email (admin only) */
export const updateRoleByEmailSchema = z.object({
  email: emailSchema,
  role: z.enum(["AUDIENCE", "ORGANIZER", "CHECKER", "ADMIN"] as const),
});

/** Schema user tự cập nhật hồ sơ (full_name / phone). Ít nhất một field. */
export const updateMeSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(255, "Full name is too long")
      .optional(),
    phone: z
      .string()
      .trim()
      .min(8, "Phone must be at least 8 characters")
      .max(20, "Phone is too long")
      .optional(),
  })
  .refine((data) => data.full_name !== undefined || data.phone !== undefined, {
    message: "At least one of full_name or phone is required.",
  });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateRoleByEmailInput = z.infer<typeof updateRoleByEmailSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
