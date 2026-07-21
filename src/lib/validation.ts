import { z } from "zod";

const cleanText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

export const registerSchema = z.object({
  name: cleanText("Name", 60).min(2, "Name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const productSchema = z.object({
  sku: cleanText("SKU", 32)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9][A-Z0-9._-]*$/.test(value), {
      message: "Use letters, numbers, dots, dashes, or underscores",
    }),
  name: cleanText("Product name", 100),
  category: cleanText("Category", 60),
  quantity: z.coerce.number().int("Quantity must be a whole number").min(0, "Quantity cannot be negative").max(1_000_000),
  lowStockThreshold: z.coerce
    .number()
    .int("Threshold must be a whole number")
    .min(0, "Threshold cannot be negative")
    .max(1_000_000),
});

export type ProductInput = z.infer<typeof productSchema>;

export function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again";
}
