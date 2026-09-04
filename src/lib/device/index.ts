import mongoose from "mongoose";
import { Device, IDevice } from "@/models/Device";

/**
 * Get the currently active device registration for a student.
 */
export async function getActiveDeviceForStudent(
  studentId: string | mongoose.Types.ObjectId
): Promise<IDevice | null> {
  return await Device.findOne({
    studentId: new mongoose.Types.ObjectId(studentId.toString()),
    status: "active",
  });
}

/**
 * Register a new active device for a student.
 * If there is an existing active device, it is revoked and the change is logged for audit.
 */
export async function registerDevice(
  studentId: string | mongoose.Types.ObjectId,
  deviceUuid: string
): Promise<IDevice> {
  const studentObjectId = new mongoose.Types.ObjectId(studentId.toString());

  // Revoke any existing active device for this student
  const existingActive = await Device.findOne({
    studentId: studentObjectId,
    status: "active",
  });

  if (existingActive) {
    existingActive.status = "revoked";
    await existingActive.save();
    console.log(
      `[AUDIT] Device Revoked (Auto-Register New): studentId=${studentObjectId.toString()}, oldDeviceId=${existingActive._id.toString()}, oldDeviceUuid=${existingActive.deviceUuid}, timestamp=${new Date().toISOString()}`
    );
  }

  // Create new active device
  const newDevice = await Device.create({
    studentId: studentObjectId,
    deviceUuid: deviceUuid.toLowerCase().trim(),
    status: "active",
    registeredAt: new Date(),
    lastSeenAt: new Date(),
  });

  return newDevice;
}

/**
 * Revoke the current active device for a student (e.g. for reset/re-registration flow).
 */
export async function revokeActiveDevice(
  studentId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const studentObjectId = new mongoose.Types.ObjectId(studentId.toString());

  const activeDevice = await Device.findOne({
    studentId: studentObjectId,
    status: "active",
  });

  if (!activeDevice) {
    return false;
  }

  activeDevice.status = "revoked";
  await activeDevice.save();

  console.log(
    `[AUDIT] Device Revoked (Controlled Reset Flow): studentId=${studentObjectId.toString()}, oldDeviceId=${activeDevice._id.toString()}, oldDeviceUuid=${activeDevice.deviceUuid}, timestamp=${new Date().toISOString()}`
  );

  return true;
}
