import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISetting extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema: Schema<ISetting> = new Schema(
  {
    key: {
      type: String,
      required: [true, "Setting key is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Key cannot exceed 100 characters"],
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, "Setting value is required"],
    },
  },
  {
    timestamps: true,
  }
);

export const Setting: Model<ISetting> =
  mongoose.models.Setting || mongoose.model<ISetting>("Setting", SettingSchema);

export default Setting;
