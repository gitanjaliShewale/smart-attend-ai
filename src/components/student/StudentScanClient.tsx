"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  ShieldCheck,
  ArrowLeft,
  Smartphone,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  KeyRound,
  RefreshCw,
  ScanFace,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  startWebcamStream,
  stopWebcamStream,
  extractFaceDescriptorFromVideo,
} from "@/lib/biometrics/client-scanner";

export function StudentScanClient() {
  const [activeTab, setActiveTab] = React.useState<"camera" | "face" | "upload" | "manual">("camera");
  const [scanState, setScanState] = React.useState<"initializing" | "scanning" | "submitting" | "success" | "error">(
    "initializing"
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [scannedToken, setScannedToken] = React.useState<string | null>(null);
  const [cameras, setCameras] = React.useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = React.useState("");

  // Biometric Face ID states
  const [faceTokenInput, setFaceTokenInput] = React.useState("");
  const [faceConfidenceScore, setFaceConfidenceScore] = React.useState<number | null>(null);
  const [isFaceEnrolled, setIsFaceEnrolled] = React.useState<boolean | null>(null);

  const scannerRef = React.useRef<any>(null);
  const isStoppingRef = React.useRef<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const faceVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const faceCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Check face enrollment status on mount
  React.useEffect(() => {
    fetch("/api/students/face/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setIsFaceEnrolled(data.data.isEnrolled);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize camera scanner when activeTab === "camera"
  React.useEffect(() => {
    if (activeTab !== "camera" || scanState === "success") return;

    let activeScanner: any = null;
    isStoppingRef.current = false;

    const startScanner = async () => {
      setScanState("initializing");
      setErrorMessage(null);

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        const element = document.getElementById("reader");
        if (!element) {
          throw new Error("Viewfinder element not found");
        }

        // Clean up previous scanner instance if any
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch {
            // ignore cleanup errors
          }
        }

        const html5QrCode = new Html5Qrcode("reader");
        activeScanner = html5QrCode;
        scannerRef.current = html5QrCode;

        // Enumerate camera devices
        let cameraConfig: any = { facingMode: "environment" };
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
            if (selectedCameraId) {
              cameraConfig = selectedCameraId;
            } else {
              const backCam = devices.find(
                (d) =>
                  d.label.toLowerCase().includes("back") ||
                  d.label.toLowerCase().includes("environment") ||
                  d.label.toLowerCase().includes("rear")
              );
              cameraConfig = backCam ? backCam.id : devices[0].id;
            }
          }
        } catch (camErr) {
          console.warn("Camera enumeration warning:", camErr);
        }

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(edge * 0.7),
                height: Math.floor(edge * 0.7),
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isStoppingRef.current) {
              handleQrDecoded(decodedText, html5QrCode);
            }
          },
          () => {
            // ignore frame parse failures
          }
        );

        setScanState("scanning");
      } catch (err: any) {
        console.error("Scanner startup error:", err);
        const errMsg = err?.toString() || "";
        if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission denied")) {
          setErrorMessage("Camera permission denied. Enable camera access or use Code/Image entry below.");
        } else {
          setErrorMessage("Could not initialize camera scanner. Please ensure webcam permissions are enabled.");
        }
        setScanState("error");
      }
    };

    startScanner();

    return () => {
      if (activeScanner && activeScanner.isScanning && !isStoppingRef.current) {
        isStoppingRef.current = true;
        activeScanner.stop().catch((e: any) => console.error("Error cleaning up scanner", e));
      }
    };
  }, [activeTab, selectedCameraId]);

  // Initialize webcam stream when activeTab === "face"
  React.useEffect(() => {
    if (activeTab !== "face" || scanState === "success") {
      stopWebcamStream(faceVideoRef.current);
      return;
    }

    setScanState("scanning");
    setErrorMessage(null);

    const timer = setTimeout(async () => {
      if (!faceVideoRef.current) return;
      try {
        await startWebcamStream(faceVideoRef.current, "user");
      } catch (err: any) {
        setErrorMessage(
          err.message || "Could not access front camera. Please allow camera permissions."
        );
        setScanState("error");
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      stopWebcamStream(faceVideoRef.current);
    };
  }, [activeTab]);

  const processAttendanceToken = async (rawToken: string) => {
    let token: string | null = null;
    try {
      const url = new URL(rawToken);
      token = url.searchParams.get("t");
    } catch {
      token = rawToken.trim();
    }

    if (!token || token.trim() === "") {
      setErrorMessage("Invalid QR code or token provided. Please scan or enter a valid attendance code.");
      setScanState("error");
      return;
    }

    const deviceUuid = typeof window !== "undefined" ? localStorage.getItem("attendqr_device_uuid") || "" : "";

    setScannedToken(token);
    setScanState("submitting");

    // Stop active camera scanner if running
    if (scannerRef.current && scannerRef.current.isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore stop error
      }
    }

    try {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, deviceUuid }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errCode = data.error?.code;
        let friendlyMessage = "No active attendance session found. Ask your teacher to start a QR session first.";

        if (errCode === "RATE_LIMIT_EXCEEDED") {
          friendlyMessage = "Too many scan attempts. Please wait a few moments before trying again.";
        } else if (errCode === "ALREADY_MARKED") {
          friendlyMessage = "Your attendance has already been recorded for this session.";
        } else if (errCode === "DEVICE_MISMATCH") {
          friendlyMessage = "Device mismatch. This browser/device is not authorized for your account. Reset device in settings.";
        } else if (errCode === "NOT_ENROLLED") {
          friendlyMessage = "Access restricted. You are not enrolled in this course.";
        } else if (errCode === "SESSION_INACTIVE" || errCode === "INVALID_TOKEN") {
          friendlyMessage = "This QR code is expired or the session has ended. Ask your teacher to refresh the QR.";
        } else if (errCode === "UNAUTHORIZED" || errCode === "NOT_FOUND") {
          friendlyMessage = "Session expired or user not found. Please log out and log in again.";
        } else if (errCode === "FORBIDDEN") {
          friendlyMessage = "Request blocked (security check). Please refresh the page and try again.";
        } else if (errCode === "INVALID_INPUT") {
          friendlyMessage = "Invalid QR code format. Please scan the QR shown on the classroom screen.";
        }

        setErrorMessage(friendlyMessage);
        setScanState("error");
      } else {
        setScanState("success");
      }
    } catch (err) {
      console.error("Attendance submission error:", err);
      setErrorMessage("An unexpected error occurred during attendance logging.");
      setScanState("error");
    }
  };

  // Face ID Biometric Attendance submission handler
  const handleFaceBiometricSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!faceVideoRef.current) return;

    let token = faceTokenInput.trim();
    if (token.startsWith("http")) {
      try {
        const url = new URL(token);
        token = url.searchParams.get("t") || token;
      } catch {}
    }

    if (!token) {
      setErrorMessage("Please enter the class attendance session token or URL.");
      setScanState("error");
      return;
    }

    setScanState("submitting");
    setErrorMessage(null);

    try {
      const captured = extractFaceDescriptorFromVideo(faceVideoRef.current, faceCanvasRef.current || undefined);

      if (!captured.hasFace || captured.descriptor.length === 0) {
        setErrorMessage("No clear face detected in the frame. Please look directly into the camera with good lighting.");
        setScanState("error");
        return;
      }

      const deviceUuid = typeof window !== "undefined" ? localStorage.getItem("attendqr_device_uuid") || "" : "";

      const res = await fetch("/api/attendance/face-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          deviceUuid,
          liveFaceDescriptor: captured.descriptor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errCode = data.error?.code;
        let msg = data.error?.message || "Facial verification failed.";

        if (errCode === "FACE_NOT_ENROLLED") {
          msg = "You have not set up your Face ID yet. Please enroll in your Profile first.";
        } else if (errCode === "FACE_MISMATCH") {
          msg = "Biometric mismatch. Live face does not match your enrolled profile template.";
        } else if (errCode === "ALREADY_MARKED") {
          msg = "Your attendance has already been recorded for this session.";
        }

        setErrorMessage(msg);
        setScanState("error");
      } else {
        setFaceConfidenceScore(data.data?.faceConfidence ?? 95);
        stopWebcamStream(faceVideoRef.current);
        setScanState("success");
      }
    } catch (err) {
      console.error("Face attendance submission error:", err);
      setErrorMessage("An unexpected error occurred during facial verification.");
      setScanState("error");
    }
  };

  const handleQrDecoded = async (text: string, scanner: any) => {
    await processAttendanceToken(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanState("initializing");
    setErrorMessage(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("upload-scanner-hidden");
      const decodedResult = await html5QrCode.scanFile(file, true);
      await processAttendanceToken(decodedResult);
    } catch (err) {
      console.error("QR Image Scan Error:", err);
      setErrorMessage("Could not detect a valid QR code in the uploaded image. Please try another image.");
      setScanState("error");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenInput.trim()) {
      setErrorMessage("Please enter an attendance token or URL.");
      setScanState("error");
      return;
    }
    processAttendanceToken(manualTokenInput);
  };

  const handleRetry = () => {
    isStoppingRef.current = false;
    setScanState("initializing");
    setErrorMessage(null);
    setScannedToken(null);
    if (activeTab === "camera") {
      window.location.reload();
    }
  };

  return (
    <PageContainer
      title="Student Attendance Check-In"
      description="Select your preferred attendance method: live QR scanner or biometric Face ID verification."
      badge={
        <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          Device Linked
        </Badge>
      }
      actions={
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      }
      maxWidth="narrow"
    >
      <div className="space-y-6">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl bg-slate-200/80 p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("camera");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "camera"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>QR Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("face");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "face"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ScanFace className="w-3.5 h-3.5 text-emerald-600" />
            <span>Face ID</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("upload");
              setErrorMessage(null);
              setScanState("initializing");
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "upload"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("manual");
              setErrorMessage(null);
              setScanState("initializing");
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "manual"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter Code</span>
          </button>
        </div>

        {/* Hidden element for file upload scanning */}
        <div id="upload-scanner-hidden" className="hidden" />

        {/* MAIN VIEWPORT / SCAN CONTAINER */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            {scanState === "success" ? (
              /* Success confirmation state */
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                    {activeTab === "face" ? (
                      <UserCheck className="w-10 h-10" />
                    ) : (
                      <CheckCircle2 className="w-10 h-10" />
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] ring-2 ring-white">
                    ✓
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Attendance Recorded!
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {activeTab === "face"
                      ? `Verified with Biometric Face ID (${faceConfidenceScore ?? 95}% Match). Your presence has been logged in the roster.`
                      : "Your QR token was validated and attendance has been logged successfully."}
                  </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                  <Link href="/dashboard" className="flex-1">
                    <Button variant="primary" className="w-full text-xs">
                      Go to Dashboard
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={handleRetry} className="flex-1 text-xs">
                    Mark Another
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {/* ── OPTION A: Live QR Scanner ───────────────────────────── */}
                {activeTab === "camera" && (
                  <div className="space-y-4">
                    <div className="relative mx-auto max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                      <div id="reader" className="w-full h-full" />

                      {scanState === "initializing" && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-2">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                          <span className="text-xs font-medium tracking-wide">Starting Camera Scanner...</span>
                        </div>
                      )}

                      {scanState === "submitting" && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-2">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                          <span className="text-xs font-medium tracking-wide">Validating Token...</span>
                        </div>
                      )}

                      {/* Laser scanner effect */}
                      {scanState === "scanning" && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
                          <div className="w-full border-t-2 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
                        </div>
                      )}
                    </div>

                    {cameras.length > 1 && (
                      <div className="flex justify-center">
                        <select
                          value={selectedCameraId || ""}
                          onChange={(e) => setSelectedCameraId(e.target.value || null)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
                        >
                          {cameras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* ── OPTION B: Live Biometric Face ID Recognition ────────── */}
                {activeTab === "face" && (
                  <div className="space-y-4">
                    {isFaceEnrolled === false ? (
                      <div className="p-6 text-center space-y-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <ScanFace className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-900">
                            Face ID Not Enrolled Yet
                          </h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            To use facial attendance verification, please register your face profile in your account settings first.
                          </p>
                        </div>
                        <Link href="/profile">
                          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Enroll Face ID Now
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <form onSubmit={handleFaceBiometricSubmit} className="space-y-4">
                        <div className="relative mx-auto max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-emerald-500/40">
                          <video
                            ref={faceVideoRef}
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                            style={{ transform: "scaleX(-1)" }}
                          />
                          <canvas ref={faceCanvasRef} className="hidden" />

                          {/* Oval face guide */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-52 h-64 rounded-[50%] border-2 border-dashed border-emerald-400/80 animate-pulse flex items-center justify-center">
                              <div className="w-48 h-60 rounded-[50%] border border-emerald-300/30" />
                            </div>
                          </div>

                          <div className="absolute top-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md rounded-lg p-2 text-center text-xs text-emerald-300 font-medium border border-emerald-500/20">
                            Align your face in the oval & verify
                          </div>

                          {scanState === "submitting" && (
                            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-2 z-10">
                              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                              <span className="text-xs font-medium tracking-wide">
                                Verifying Biometrics & Marking Attendance...
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Token Input for class session */}
                        <div className="max-w-sm mx-auto space-y-2">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            Class QR Token / Session Code
                          </label>
                          <input
                            type="text"
                            placeholder="Enter or paste active classroom token"
                            value={faceTokenInput}
                            onChange={(e) => setFaceTokenInput(e.target.value)}
                            disabled={scanState === "submitting"}
                            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                          />
                        </div>

                        <div className="max-w-sm mx-auto">
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={scanState === "submitting" || !faceTokenInput.trim()}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2 py-2.5"
                          >
                            <ScanFace className="w-4 h-4" />
                            Verify Face & Check In
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ── OPTION C: Upload Image ──────────────────────────────── */}
                {activeTab === "upload" && (
                  <div className="space-y-4 text-center py-6">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 max-w-sm mx-auto cursor-pointer transition-colors space-y-3 bg-slate-50/50"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-900">
                          Click to select a QR code photo
                        </p>
                        <p className="text-[11px] text-slate-400">PNG, JPG, or WEBP screenshot</p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* ── OPTION D: Enter Manual Code ─────────────────────────── */}
                {activeTab === "manual" && (
                  <form onSubmit={handleManualSubmit} className="space-y-4 max-w-sm mx-auto py-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Attendance Token / URL
                      </label>
                      <input
                        type="text"
                        placeholder="Paste URL or 32-character token"
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        disabled={scanState === "submitting"}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-mono focus:border-[#0f2b48] focus:ring-2 focus:ring-[#0f2b48]/20 focus:outline-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={scanState === "submitting" || !manualTokenInput.trim()}
                      className="w-full text-xs gap-2 py-2"
                    >
                      {scanState === "submitting" ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Token"
                      )}
                    </Button>
                  </form>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 max-w-sm mx-auto">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p>{errorMessage}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="text-[11px] h-7 px-2.5 text-rose-800 border-rose-300 hover:bg-rose-100/60"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Footer Note */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Device identity UUID and biometric descriptors are encrypted for fraud prevention.</span>
        </div>
      </div>
    </PageContainer>
  );
}
