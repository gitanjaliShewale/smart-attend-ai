import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendanceSession extends Document {
  _id: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  token: string;
  status: "active" | "expired" | "stopped";
  startedAt: Date;
  expiresAt: Date;
  stoppedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema: Schema<IAttendanceSession> = new Schema(
  {
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Teacher ID is required"],
      index: true,
    },
    token: {
      type: String,
      required: [true, "Session token is required"],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "expired", "stopped"],
        message: "{VALUE} is not a valid session status",
      },
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration timestamp is required"],
      index: true,
    },
    stoppedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AttendanceSessionSchema.index({ status: 1, expiresAt: 1 });

export const AttendanceSession: Model<IAttendanceSession> =
  mongoose.models.AttendanceSession ||
  mongoose.model<IAttendanceSession>("AttendanceSession", AttendanceSessionSchema);

export default AttendanceSession;
