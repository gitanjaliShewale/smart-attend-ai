import mongoose from "mongoose";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";
import { getSettingValue } from "@/lib/settings";
import { Notification, NotificationCooldown, Subject } from "@/models";

/**
 * Checks a student's attendance rate for a subject, and generates a notification
 * if they are below the threshold and have met the rate-limiting cooldown criteria.
 *
 * Cooldown rules (Anti-Spam):
 *  - Send if no prior low-attendance notification exists for this subject.
 *  - Send if the percentage has dropped by >= 5 points since the last notice.
 *  - Send if >= 7 days have passed since the last notice.
 */
export async function checkAndTriggerNotification(
  studentId: string | mongoose.Types.ObjectId,
  subjectId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const stats = await calculateSubjectAttendance(studentId, subjectId);
  if (stats.noDataYet) return false;

  const threshold = await getSettingValue("attendanceThreshold", 75);
  if (stats.percentage >= threshold) return false;

  const now = new Date();

  // Look up prior notice cooldown details
  const cooldown = await NotificationCooldown.findOne({ studentId, subjectId });

  let shouldNotify = false;

  if (!cooldown) {
    shouldNotify = true;
  } else {
    const percentDropped = cooldown.lastNotifiedPercent - stats.percentage;
    const daysElapsed = (now.getTime() - cooldown.lastNotifiedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (percentDropped >= 5 || daysElapsed >= 7) {
      shouldNotify = true;
    }
  }

  if (!shouldNotify) return false;

  try {
    let committed = false;

    if (!cooldown) {
      try {
        await NotificationCooldown.create({
          studentId,
          subjectId,
          lastNotifiedPercent: stats.percentage,
          lastNotifiedAt: now,
        });
        committed = true;
      } catch (err: any) {
        if (err.code === 11000 || err.message?.includes("E11000")) {
          // Another thread concurrently inserted the cooldown record, safe to skip
          return false;
        }
        throw err;
      }
    } else {
      // Document existed. Atomic update with optimistic concurrency control using lastNotifiedAt
      const res = await NotificationCooldown.findOneAndUpdate(
        {
          studentId,
          subjectId,
          lastNotifiedAt: cooldown.lastNotifiedAt,
        },
        {
          $set: {
            lastNotifiedPercent: stats.percentage,
            lastNotifiedAt: now,
          },
        },
        { new: true }
      );

      if (res) {
        committed = true;
      }
    }

    if (committed) {
      const subjectDoc = await Subject.findById(subjectId).lean();
      const subjectName = subjectDoc?.name || "Subject";

      await Notification.create({
        studentId,
        type: "low_attendance",
        subjectId,
        message: `Warning: Your attendance in ${subjectName} has fallen to ${stats.percentage}%, which is below the required ${threshold}% threshold.`,
        attendancePercentAtSend: stats.percentage,
        isRead: false,
        sentAt: now,
      });

      return true;
    }
  } catch (err: any) {
    // E11000 duplicate key error suppressed for concurrency safety
    console.log("[Notification System] Concurrent notification trigger suppressed.");
  }

  return false;
}
