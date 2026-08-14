import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClass extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  teacherId: mongoose.Types.ObjectId;
  academicTerm: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema: Schema<IClass> = new Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      maxlength: [100, "Class name cannot exceed 100 characters"],
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Teacher ID reference is required"],
      index: true,
    },
    academicTerm: {
      type: String,
      required: [true, "Academic term is required"],
      trim: true,
      maxlength: [50, "Academic term cannot exceed 50 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Class: Model<IClass> =
  mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);

export default Class;
