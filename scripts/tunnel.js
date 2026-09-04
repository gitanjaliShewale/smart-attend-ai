/**
 * ngrok Live Tunnel Runner for AttendQR.
 *
 * Forwards local port 3000 to a public HTTPS URL.
 * Enables live mobile phone testing with HTTPS (required for mobile webcam QR scanning).
 *
 * Usage: npm run tunnel
 */
const path = require("path");
const fs = require("fs");
const ngrok = require("@ngrok/ngrok");

// Load .env variables
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf-8");
  raw.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || "").trim();
    }
  });
}

async function startTunnel() {
  console.log("🚀 Initializing ngrok secure HTTPS tunnel for AttendQR...");

  const authtoken = process.env.NGROK_AUTHTOKEN;

  const options = {
    addr: 3000,
  };

  if (authtoken) {
    options.authtoken = authtoken;
  } else {
    console.log("ℹ️  Tip: To avoid session limits, add NGROK_AUTHTOKEN=<your_token> in your .env file.");
    console.log("   (Get a free token at https://dashboard.ngrok.com/get-started/your-authtoken)\n");
  }

  try {
    const listener = await ngrok.forward(options);
    const publicUrl = listener.url();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ATTENDQR IS NOW LIVE ON THE INTERNET VIA NGROK!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🌐 Public HTTPS URL:  ${publicUrl}`);
    console.log(`📱 QR Scan Page:      ${publicUrl}/scan`);
    console.log(`👩‍🏫 Teacher Portal:    ${publicUrl}/teacher/dashboard`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ Features Enabled with ngrok HTTPS:");
    console.log("  1. Mobile Phone Camera Scanning (iOS Safari & Android Chrome require HTTPS)");
    console.log("  2. Remote access for teachers and students anywhere");
    console.log("\nPress Ctrl+C anytime to stop the tunnel.");

    // Keep process alive
    process.stdin.resume();

    // Clean exit handling
    const cleanup = async () => {
      console.log("\n🧹 Closing ngrok tunnel...");
      try {
        await listener.close();
      } catch {}
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (err) {
    console.error("❌ Failed to start ngrok tunnel:", err.message);
    if (err.message && err.message.includes("authtoken")) {
      console.log("\n🔑 An ngrok authtoken is required by ngrok.");
      console.log("1. Sign up for free at https://dashboard.ngrok.com/signup");
      console.log("2. Copy your Auth Token from https://dashboard.ngrok.com/get-started/your-authtoken");
      console.log("3. Add this line to your .env file:");
      console.log("   NGROK_AUTHTOKEN=your_ngrok_auth_token_here");
      console.log("4. Run `npm run tunnel` again.");
    }
    process.exit(1);
  }
}

startTunnel();
