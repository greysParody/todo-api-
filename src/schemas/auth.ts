import { z } from "zod";

// Messages match the frontend's own validation so users see the same wording either way.

export const emailSchema = z
  .string({ error: "Enter your email." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "Email must be at most 254 characters."));

export const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const nameSchema = z
  .string({ error: "Enter your name." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(60, "Name must be at most 60 characters.");

const tokenSchema = z.string({ error: "Token is required." }).min(1, "Token is required.").max(512, "Token is invalid.");

/** Used where we only check a password, never set one: the rules may have changed since it was created. */
const anyPassword = (message: string) => z.string({ error: message }).min(1, message).max(1024, message);

export const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: anyPassword("Enter your password.") });
export const emailOnlySchema = z.object({ email: emailSchema });
export const tokenOnlySchema = z.object({ token: tokenSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });

export const updateProfileSchema = z.object({ name: nameSchema });
export const changePasswordSchema = z.object({
  currentPassword: anyPassword("Enter your current password."),
  newPassword: passwordSchema,
});
export const deleteAccountSchema = z.object({ password: anyPassword("Enter your password.") });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
