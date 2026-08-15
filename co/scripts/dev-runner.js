/**
 * Developer Sandbox Runner.
 * Starts an in-memory MongoDB database, updates the local .env connection URI,
 * and launches Next.js development server.
 * Keep this running while testing the application inside your Browser!
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting programmatical developer sandbox...");

  // 1. Start MongoDB Memory Server
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: "attendance_dev",
    },
  });
  const mongoUri = mongod.getUri();
  console.log(`📡 In-Memory MongoDB started at: ${mongoUri}`);

  // 2. Read existing .env to preserve existing keys (e.g. WATSONX_*)
  const envPath = path.resolve(__dirname, "../.env");
  let existingEnv = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf-8");
    raw.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        existingEnv[key] = val.trim();
      }
    });
  }

  // 3. Write/Rewrite .env with correct dynamic Mongo URI while preserving all other keys
  existingEnv["MONGODB_URI"] = mongoUri;
  if (!existingEnv["AUTH_SECRET"]) existingEnv["AUTH_SECRET"] = "local_development_auth_secret_32_chars_minimum";
  if (!existingEnv["QR_TOKEN_SECRET"]) existingEnv["QR_TOKEN_SECRET"] = "local_development_qr_secret_32_chars_minimum";
  if (!existingEnv["NEXTAUTH_URL"]) existingEnv["NEXTAUTH_URL"] = "http://localhost:3000";
  if (!existingEnv["AUTH_TRUST_HOST"]) existingEnv["AUTH_TRUST_HOST"] = "true";

  const envContent = Object.entries(existingEnv)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log("📝 Updated .env connection string with active database port.");

  // 4. Seed database with initial demo users and data
  console.log("🌱 Seeding database with demo users...");
  try {
    process.env.MONGODB_URI = mongoUri;
    const jiti = require("jiti")(path.resolve(__filename));
    const { seed } = jiti("./seed.ts");
    await seed();
    console.log("✅ Seed completed successfully!");
  } catch (err) {
    console.error("❌ Seed script error:", err);
  }

  // 5. Start Next.js development server
  console.log("🔌 Launching Next.js development server...");
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? "cmd.exe" : "npm";
  const args = isWindows ? ["/c", "npm run dev"] : ["run", "dev"];

  const devProcess = spawn(cmd, args, {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
    },
  });

  devProcess.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  devProcess.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  // Handle termination signals
  const cleanup = async () => {
    console.log("\n🧹 Cleaning up database and dev server processes...");
    try {
      devProcess.kill();
      await mongod.stop();
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  console.error("❌ Critical sandbox runner error:", err);
  process.exit(1);
});
