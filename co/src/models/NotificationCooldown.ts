import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotificationCooldown extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  lastNotifiedPercent: number;
  lastNotifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationCooldownSchema: Schema<INotificationCooldown> = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    lastNotifiedPercent: {
      type: Number,
      required: true,
    },
    lastNotifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index to allow atomic upserts and prevent concurrent double-sending
NotificationCooldownSchema.index({ studentId: 1, subjectId: 1 }, { unique: true });

export const NotificationCooldown: Model<INotificationCooldown> =
  mongoose.models.NotificationCooldown ||
  mongoose.model<INotificationCooldown>("NotificationCooldown", NotificationCooldownSchema);

export default NotificationCooldown;
