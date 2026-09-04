import { z } from "zod";

export const registerDeviceSchema = z.object({
  deviceUuid: z.string().uuid("Invalid device UUID format"),
});

export const resetDeviceSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
