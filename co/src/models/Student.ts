import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFaceProfile {
  isEnrolled: boolean;
  enrolledAt?: Date;
  faceDescriptor?: number[];
  referencePhotoUrl?: string;
}

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  studentCode: string;
  fullName: string;
  activeDeviceId?: mongoose.Types.ObjectId | null;
  faceProfile?: IFaceProfile;
  createdAt: Date;
  updatedAt: Date;
}

const FaceProfileSchema = new Schema<IFaceProfile>(
  {
    isEnrolled: {
      type: Boolean,
      default: false,
    },
    enrolledAt: {
      type: Date,
    },
    faceDescriptor: {
      type: [Number],
      default: [],
    },
    referencePhotoUrl: {
      type: String,
    },
  },
  { _id: false }
);

const StudentSchema: Schema<IStudent> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID reference is required"],
      unique: true,
    },
    studentCode: {
      type: String,
      required: [true, "Student code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [50, "Student code cannot exceed 50 characters"],
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    activeDeviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
    faceProfile: {
      type: FaceProfileSchema,
      default: () => ({ isEnrolled: false, faceDescriptor: [] }),
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);

export default Student;
