/**
 * MongoDB Memory Server Startup Script
 * Starts an in-memory MongoDB instance and prints the connection URI
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

async function startMongoDB() {
  try {
    console.log("🚀 Starting MongoDB Memory Server...");
    const mongod = await MongoMemoryServer.create({
      instance: {
        dbName: "attendance_dev",
      },
    });
    
    const mongoUri = mongod.getUri();
    console.log(`✅ MongoDB Memory Server started successfully!`);
    console.log(`📡 Connection URI: ${mongoUri}`);
    console.log(`\n⚠️  Update your .env file with:`);
    console.log(`MONGODB_URI=${mongoUri}`);
    
    // Keep the server running
    console.log("\n✓ MongoDB is running. Press Ctrl+C to stop.\n");
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🧹 Stopping MongoDB Memory Server...");
      await mongod.stop();
      process.exit(0);
    });
    
    // Prevent the script from exiting
    setInterval(() => {}, 1000);
    
  } catch (err) {
    console.error("❌ Failed to start MongoDB Memory Server:", err);
    process.exit(1);
  }
}

startMongoDB();
