import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendanceRecord extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  status: "present";
  verificationMethod?: "qr" | "face" | "manual";
  faceMatchScore?: number;
  serverTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema: Schema<IAttendanceRecord> = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceSession",
      required: [true, "Session ID is required"],
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject ID is required"],
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: [true, "Device ID is required"],
    },
    status: {
      type: String,
      enum: {
        values: ["present"],
        message: "{VALUE} is not a valid attendance status",
      },
      default: "present",
      required: true,
    },
    verificationMethod: {
      type: String,
      enum: ["qr", "face", "manual"],
      default: "qr",
    },
    faceMatchScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    serverTimestamp: {
      type: Date,
      default: Date.now,
      required: [true, "Server timestamp is required"],
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL COMPOUND UNIQUE INDEX: Enforces atomic duplicate-attendance prevention at DB level
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

// Compound Index: For high-speed student subject attendance percentage calculation
AttendanceRecordSchema.index({ studentId: 1, subjectId: 1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecord>("AttendanceRecord", AttendanceRecordSchema);

export default AttendanceRecord;
