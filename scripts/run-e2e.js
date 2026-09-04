/**
 * Playwright E2E Test Runner with Self-Contained MongoDB Memory Server.
 * Runs next build, spins up MongoMemoryServer, runs next start, and executes Playwright tests.
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

async function main() {
  console.log("🚀 Starting Playwright E2E Self-Contained Environment...");

  // 1. Start MongoDB Memory Server programmatically
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: "attendance_e2e",
    }
  });
  const mongoUri = mongod.getUri();
  console.log(`📡 MongoDB Memory Server started at: ${mongoUri}`);

  // Set shared environment variables
  const authSecret = "e2e_testing_auth_secret_must_be_32_chars_long_minimum";
  const qrSecret = "e2e_testing_qr_secret_must_be_32_chars_long_minimum";
  const nextauthUrl = "http://localhost:3000";

  const env = {
    ...process.env,
    MONGODB_URI: mongoUri,
    AUTH_SECRET: authSecret,
    QR_TOKEN_SECRET: qrSecret,
    NEXTAUTH_URL: nextauthUrl,
    AUTH_TRUST_HOST: "true",
    NODE_ENV: "production",
    PORT: "3000"
  };

  // 2. Start Next.js production build
  console.log("📦 Compiling Next.js production build...");
  const buildProcess = spawn("cmd.exe", ["/c", "npm run build"], {
    cwd: path.resolve(__dirname, ".."),
    env
  });

  await new Promise((resolve, reject) => {
    buildProcess.stdout.on("data", (data) => process.stdout.write(data));
    buildProcess.stderr.on("data", (data) => process.stderr.write(data));
    buildProcess.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with exit code ${code}`));
    });
  });

  // 3. Start Next.js server
  console.log("🔌 Starting Next.js production server...");
  const serverProcess = spawn("cmd.exe", ["/c", "npx next start -p 3000"], {
    cwd: path.resolve(__dirname, ".."),
    env
  });

  // Track stdout/stderr of Next.js server
  serverProcess.stdout.on("data", (data) => {
    // Only print errors or specific logs to avoid clutter
    if (data.toString().includes("error") || data.toString().includes("Warning")) {
      process.stdout.write(`[Next.js] ${data}`);
    }
  });

  serverProcess.stderr.on("data", (data) => {
    process.stderr.write(`[Next.js ERR] ${data}`);
  });

  // 4. Wait for Next.js to start responding on port 3000
  console.log("⏳ Waiting for Next.js server to be ready on port 3000...");
  let attempts = 0;
  const maxAttempts = 30;
  const isServerReady = () => new Promise((resolve) => {
    const req = http.get("http://localhost:3000/login", (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    });
    req.on("error", () => resolve(false));
    req.end();
  });

  while (attempts < maxAttempts) {
    const ready = await isServerReady();
    if (ready) {
      console.log("✅ Next.js server is ready!");
      break;
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (attempts >= maxAttempts) {
    console.error("❌ Next.js server failed to respond on port 3000 in time.");
    serverProcess.kill();
    await mongod.stop();
    process.exit(1);
  }

  // 5. Run Playwright E2E Tests
  console.log("🎭 Executing Playwright E2E Tests...");
  const playwrightProcess = spawn("cmd.exe", ["/c", "npx playwright test"], {
    cwd: path.resolve(__dirname, ".."),
    env
  });

  playwrightProcess.stdout.on("data", (data) => process.stdout.write(data));
  playwrightProcess.stderr.on("data", (data) => process.stderr.write(data));

  const exitCode = await new Promise((resolve) => {
    playwrightProcess.on("close", (code) => {
      resolve(code);
    });
  });

  // 6. Cleanup
  console.log("🧹 Cleaning up server and database processes...");
  serverProcess.kill();
  await mongod.stop();

  console.log(`🏁 E2E Run finished with exit code ${exitCode}`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("❌ Critical E2E Runner Error:", err);
  process.exit(1);
});
