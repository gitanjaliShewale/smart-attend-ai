/**
 * End-to-End Test for Biometric Face Recognition Attendance.
 */
const http = require("http");

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: d }); }
      });
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

async function loginUser(email, password) {
  const csrfResp = await req({ hostname: "localhost", port: 3000, path: "/api/auth/csrf", method: "GET" });
  const csrfToken = csrfResp.body.csrfToken;
  const initCookies = (csrfResp.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

  const loginBody = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&csrfToken=${csrfToken}&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F&json=true`;
  const loginResp = await req({
    hostname: "localhost", port: 3000,
    path: "/api/auth/callback/credentials", method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(loginBody),
      "Cookie": initCookies,
      "Origin": "http://localhost:3000",
    }
  }, loginBody);

  const allCookies = [
    ...initCookies.split("; "),
    ...(loginResp.headers["set-cookie"] || []).map(c => c.split(";")[0])
  ].filter(Boolean).join("; ");

  return { cookies: allCookies };
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Testing Biometric Face ID Attendance Flow");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Teacher gets or starts session
  console.log("👩‍🏫 1. Getting / Starting active class session as Teacher...");
  const teacher = await loginUser("varsha.sahane@university.edu", "Password123!");

  let activeResp = await req({ hostname: "localhost", port: 3000, path: "/api/qr/active", method: "GET", headers: { "Cookie": teacher.cookies } });
  let token = activeResp.body?.data?.token;

  if (!token) {
    const classesResp = await req({ hostname: "localhost", port: 3000, path: "/api/classes", method: "GET", headers: { "Cookie": teacher.cookies } });
    const cls = classesResp.body.data[0];
    const classId = cls.id || cls._id;
    const subjectsResp = await req({ hostname: "localhost", port: 3000, path: `/api/subjects?classId=${classId}`, method: "GET", headers: { "Cookie": teacher.cookies } });
    const subj = subjectsResp.body.data[0];
    const subjectId = subj.id || subj._id;

    const startBody = JSON.stringify({ classId, subjectId });
    const startResp = await req({
      hostname: "localhost", port: 3000, path: "/api/qr/start", method: "POST",
      headers: {
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(startBody),
        "Cookie": teacher.cookies, "Origin": "http://localhost:3000", "Referer": "http://localhost:3000/teacher/dashboard",
      }
    }, startBody);

    token = startResp.body.data?.token;
  }

  console.log("   ✅ Active session token:", token);

  // 2. Student logs in
  console.log("\n👨‍🎓 2. Student Login: sameer.tamboli@university.edu");
  const student = await loginUser("sameer.tamboli@university.edu", "Password123!");

  // 3. Enroll Face ID
  console.log("\n👤 3. Enrolling Student Facial Biometric Template...");
  const testFaceVector = new Array(128).fill(0).map((_, i) => Math.cos(i * 0.2) * 0.5 + 0.5);
  const enrollBody = JSON.stringify({ faceDescriptor: testFaceVector });
  const enrollResp = await req({
    hostname: "localhost", port: 3000, path: "/api/students/face/enroll", method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(enrollBody),
      "Cookie": student.cookies,
      "Origin": "http://localhost:3000",
      "Referer": "http://localhost:3000/profile",
    }
  }, enrollBody);
  console.log("   Enroll response HTTP:", enrollResp.status, JSON.stringify(enrollResp.body));
  console.log("   ✅ Face Enrollment status:", enrollResp.body?.data?.message || enrollResp.body);

  // 4. Mark Attendance via Face Biometrics
  console.log("\n✨ 4. Marking Attendance via Live Face Scan (/api/attendance/face-mark)...");
  // Matching live vector with minor noise
  const liveMatchVector = testFaceVector.map(v => v + (Math.random() - 0.5) * 0.03);
  const faceMarkBody = JSON.stringify({
    token,
    deviceUuid: "a1b2c3d4-e5f6-4a7b-8c9d-100000000002",
    liveFaceDescriptor: liveMatchVector,
  });

  const faceMarkResp = await req({
    hostname: "localhost", port: 3000, path: "/api/attendance/face-mark", method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(faceMarkBody),
      "Cookie": student.cookies,
      "Origin": "http://localhost:3000",
      "Referer": "http://localhost:3000/scan",
    }
  }, faceMarkBody);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (faceMarkResp.body?.success) {
    console.log("  🎉 BIOMETRIC FACE ATTENDANCE RECORDED!");
    console.log("  Verification Method :", faceMarkResp.body.data?.verificationMethod);
    console.log("  Biometric Match     :", faceMarkResp.body.data?.faceConfidence + "%");
    console.log("  Server Timestamp    :", faceMarkResp.body.data?.serverTimestamp);
  } else {
    console.log("  Result:", JSON.stringify(faceMarkResp.body));
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(console.error);
