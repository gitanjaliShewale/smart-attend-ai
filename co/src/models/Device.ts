import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDevice extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  deviceUuid: string;
  status: "active" | "revoked";
  registeredAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema: Schema<IDevice> = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
    },
    deviceUuid: {
      type: String,
      required: [true, "Device UUID is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "revoked"],
        message: "{VALUE} is not a valid device status",
      },
      default: "active",
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookup of active devices for a given student
DeviceSchema.index({ studentId: 1, status: 1 });

export const Device: Model<IDevice> =
  mongoose.models.Device || mongoose.model<IDevice>("Device", DeviceSchema);

export default Device;
