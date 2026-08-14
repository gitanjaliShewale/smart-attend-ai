import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { User, Student, Teacher } from "@/models";
import { registerSchema, RegisterInput } from "@/lib/validation/auth.schema";

export interface RegisterResult {
  success: boolean;
  data?: {
    userId: string;
    email: string;
    role: "student" | "teacher";
    fullName: string;
    studentId?: string;
    teacherId?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Generic message used for all registration failures to prevent account enumeration. */
const GENERIC_FAIL_RESPONSE: RegisterResult = {
  success: false,
  error: {
    code: "REGISTRATION_FAILED",
    message:
      "Unable to complete registration with the provided details. Please check your credentials.",
  },
};

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  // 1. Validate Input
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message || "Invalid registration data",
        details: parsed.error.format(),
      },
    };
  }

  const { email, password, fullName, role, studentCode } = parsed.data;

  await connectToDatabase();

  // 2. Pre-existence checks — same generic message for all to prevent enumeration
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return GENERIC_FAIL_RESPONSE;
  }

  if (role === "student" && studentCode) {
    const existingStudentCode = await Student.findOne({
      studentCode: studentCode.trim().toUpperCase(),
    });
    if (existingStudentCode) {
      return GENERIC_FAIL_RESPONSE;
    }
  }

  // 3. Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 4. Attempt to use Mongo transactions; fall back gracefully to non-transactional
  //    saves when running on a standalone mongod (development / CI MongoMemoryServer).
  let mongoSession: mongoose.ClientSession | null = null;

  try {
    mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
  } catch {
    // Standalone mode — no replica set; transactions are unavailable.
    if (mongoSession) {
      try {
        await mongoSession.endSession();
      } catch {
        // ignore cleanup error
      }
    }
    mongoSession = null;
  }

  const save = async <T>(doc: mongoose.Document<T>) => {
    if (mongoSession) {
      return doc.save({ session: mongoSession });
    }
    return doc.save();
  };

  try {
    const userDoc = new User({ email, passwordHash, role, isActive: true });
    await save(userDoc);

    let studentId: string | undefined;
    let teacherId: string | undefined;

    if (role === "student") {
      const studentDoc = new Student({
        userId: userDoc._id,
        studentCode: studentCode!.trim().toUpperCase(),
        fullName: fullName.trim(),
      });
      await save(studentDoc);
      studentId = studentDoc._id.toString();
    } else {
      const teacherDoc = new Teacher({
        userId: userDoc._id,
        fullName: fullName.trim(),
      });
      await save(teacherDoc);
      teacherId = teacherDoc._id.toString();
    }

    if (mongoSession) {
      await mongoSession.commitTransaction();
    }

    return {
      success: true,
      data: {
        userId: userDoc._id.toString(),
        email: userDoc.email,
        role: userDoc.role,
        fullName: fullName.trim(),
        studentId,
        teacherId,
      },
    };
  } catch (err: unknown) {
    if (mongoSession) {
      try {
        await mongoSession.abortTransaction();
      } catch {
        // ignore abort error
      }
    }

    // Duplicate key error (race condition after pre-check passed) — treat as generic failure
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return GENERIC_FAIL_RESPONSE;
    }

    console.error("[Auth Register Error]:", err);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during registration. Please try again later.",
      },
    };
  } finally {
    if (mongoSession) {
      try {
        await mongoSession.endSession();
      } catch {
        // ignore cleanup error
      }
    }
  }
}
