/**
 * MongoDB Mongoose cached connection singleton for Next.js serverless runtime.
 * Includes automatic in-memory MongoDB fallback and auto-seeding for zero-config local development.
 */
import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
  var inMemoryMongoServer: any | undefined;
  var inMemoryMongoUri: string | undefined;
  var isAutoSeeding: boolean | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function getOrStartInMemoryMongo(): Promise<string> {
  if (global.inMemoryMongoUri) {
    return global.inMemoryMongoUri;
  }

  if (!global.inMemoryMongoServer) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    global.inMemoryMongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: "attendance_dev",
      },
    });
    global.inMemoryMongoUri = global.inMemoryMongoServer.getUri();
    console.log(`📡 [Database] In-memory MongoDB started at: ${global.inMemoryMongoUri}`);
  }

  return global.inMemoryMongoUri!;
}

async function autoSeedIfEmpty(): Promise<void> {
  if (global.isAutoSeeding) return;
  global.isAutoSeeding = true;

  try {
    const { User } = await import("../../models/User");
    const count = await User.countDocuments();
    if (count === 0) {
      console.log("🌱 [Database] Database is empty. Auto-seeding initial demo accounts...");
      const { seedDatabase } = await import("./seed-data");
      await seedDatabase(false);
      console.log("✅ [Database] Demo accounts auto-seeded successfully!");
    }
  } catch (err) {
    console.warn("⚠️ [Database] Auto-seeding check skipped:", err);
  } finally {
    global.isAutoSeeding = false;
  }
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  // If Mongoose already has an active connection, reuse it.
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  const isDev = process.env.NODE_ENV !== "production";
  const configuredUri = process.env.MONGODB_URI;

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: isDev ? 3000 : 10000,
    };

    cached.promise = (async () => {
      // 1. Try configured URI if provided
      if (configuredUri && configuredUri.trim().length > 0) {
        try {
          const instance = await mongoose.connect(configuredUri, opts);
          if (isDev) {
            await autoSeedIfEmpty();
          }
          return instance;
        } catch (err: any) {
          if (!isDev) {
            throw err;
          }
          console.warn(`⚠️ [Database] Could not connect to configured MONGODB_URI (${configuredUri}): ${err?.message || err}. Falling back to in-memory MongoDB.`);
        }
      }

      // 2. In development, fallback to in-memory MongoDB
      if (isDev) {
        const memUri = await getOrStartInMemoryMongo();
        const instance = await mongoose.connect(memUri, { bufferCommands: false });
        await autoSeedIfEmpty();
        return instance;
      }

      throw new Error("Please define the MONGODB_URI environment variable inside .env.production / server environment.");
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
