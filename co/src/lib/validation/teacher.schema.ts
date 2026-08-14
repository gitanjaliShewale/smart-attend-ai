import { z } from "zod";

export const updateTeacherProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Full name must be at least 2 characters" })
    .max(100, { message: "Full name cannot exceed 100 characters" }),
});

export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
