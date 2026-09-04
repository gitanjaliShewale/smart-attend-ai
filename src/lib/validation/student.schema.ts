import { z } from "zod";

export const updateStudentProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Full name must be at least 2 characters" })
    .max(100, { message: "Full name cannot exceed 100 characters" }),
});

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
