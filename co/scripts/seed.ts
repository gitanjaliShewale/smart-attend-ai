/**
 * Development Database Seed Script.
 * WARNING: NEVER EXECUTE IN PRODUCTION ENVIRONMENTS.
 *
 * Usage: npx tsx scripts/seed.ts (or node/ts-node)
 */
import mongoose from "mongoose";
import { seedDatabase } from "../src/lib/mongodb/seed-data";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL: Attempted to run seed script in production! Aborting.");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/attendance_dev";

  if (mongoose.connection.readyState !== 1) {
    console.log("🌱 [Seed] Connecting to MongoDB at:", uri);
    await mongoose.connect(uri);
  }

  console.log("🧹 [Seed] Seeding demo users, classes, subjects, and settings...");
  await seedDatabase(true);

  console.log("✅ [Seed] Database seeded successfully!");
  console.log("------------------------------------------");
  console.log("Teachers: varsha.sahane, aashish.kale, nilesh.sharma @university.edu");
  console.log("Students: gitanjali.shewale, sameer.tamboli, karan.nagare, vedant.deore @university.edu");
  console.log("Password for all: Password123!");
  console.log("------------------------------------------");
}

export { seed };

// Execute only if called directly
if (require.main === module) {
  seed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
