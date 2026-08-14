import { z } from "zod";

export const markAttendanceSchema = z.object({
  token: z.string().min(1, "Token is required"),
  deviceUuid: z.string().uuid("Invalid device UUID format"),
});
