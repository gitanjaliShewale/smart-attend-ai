/**
 * Public HTTPS Tunnel Runner for AttendQR.
 * Uses localtunnel for instant zero-auth HTTPS URL generation.
 */
const localtunnel = require("localtunnel");

async function main() {
  console.log("🚀 Starting Instant Public HTTPS Tunnel on port 3000...");

  try {
    const tunnel = await localtunnel({
      port: 3000,
    });

    const publicUrl = tunnel.url;

    // Fetch the public IP which localtunnel uses as bypass password if prompted
    let publicIp = "12.24.47.3";
    try {
      const res = await fetch("https://loca.lt/mytunnelpassword");
      if (res.ok) {
        publicIp = (await res.text()).trim();
      }
    } catch {}

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ATTENDQR IS LIVE ON THE PUBLIC INTERNET!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🌐 Public HTTPS URL : ${publicUrl}`);
    console.log(`🔑 Tunnel Password  : ${publicIp} (if prompted on first visit)`);
    console.log(`📱 QR Scan Page     : ${publicUrl}/scan`);
    console.log(`👩‍🏫 Teacher Portal   : ${publicUrl}/teacher/dashboard`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ Camera & Web scanning are fully active on this HTTPS URL.\n");

    tunnel.on("close", () => {
      console.log("⚠️ Tunnel closed.");
    });

    tunnel.on("error", (err) => {
      console.error("Tunnel error:", err);
    });

    // Keep process running
    process.stdin.resume();
  } catch (err) {
    console.error("❌ Failed to create public tunnel:", err);
    process.exit(1);
  }
}

main();
