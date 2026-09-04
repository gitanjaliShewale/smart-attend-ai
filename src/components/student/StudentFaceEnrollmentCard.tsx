"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ScanFace,
  CheckCircle2,
  Camera,
  RefreshCw,
  Loader2,
  AlertCircle,
  Trash2,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  startWebcamStream,
  stopWebcamStream,
  extractFaceDescriptorFromVideo,
} from "@/lib/biometrics/client-scanner";

export function StudentFaceEnrollmentCard() {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [isEnrolled, setIsEnrolled] = React.useState<boolean>(false);
  const [enrolledAt, setEnrolledAt] = React.useState<string | null>(null);

  // Camera enrollment state
  const [isScanning, setIsScanning] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const fetchFaceStatus = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students/face/status");
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEnrolled(data.data.isEnrolled);
        setEnrolledAt(data.data.enrolledAt);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFaceStatus();
  }, [fetchFaceStatus]);

  // Clean up video stream on unmount
  React.useEffect(() => {
    return () => {
      stopWebcamStream(videoRef.current);
    };
  }, []);

  const handleStartCamera = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsScanning(true);

    // Wait for video element to render
    setTimeout(async () => {
      if (!videoRef.current) return;
      try {
        await startWebcamStream(videoRef.current, "user");
        setStatusMessage("Look straight at the camera and align your face in the oval.");
      } catch (err: any) {
        setErrorMessage(
          err.message || "Could not access webcam. Please allow camera permissions in your browser."
        );
        setIsScanning(false);
      }
    }, 100);
  };

  const handleStopCamera = () => {
    stopWebcamStream(videoRef.current);
    setIsScanning(false);
    setStatusMessage(null);
  };

  const handleCaptureAndEnroll = async () => {
    if (!videoRef.current) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const captured = extractFaceDescriptorFromVideo(videoRef.current, canvasRef.current || undefined);

      if (!captured.hasFace || captured.descriptor.length === 0) {
        setErrorMessage("No clear face detected. Please ensure your face is well-lit and clearly visible.");
        setSubmitting(false);
        return;
      }

      setPreviewPhoto(captured.snapshotDataUrl);

      // Submit biometric template to backend
      const res = await fetch("/api/students/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: captured.descriptor,
          referencePhoto: captured.snapshotDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || "Failed to enroll Face ID. Please try again.");
      } else {
        handleStopCamera();
        await fetchFaceStatus();
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred during face enrollment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetFaceId = async () => {
    if (!confirm("Are you sure you want to reset your Face ID? You will need to re-enroll before using facial attendance.")) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/students/face/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchFaceStatus();
      } else {
        setErrorMessage(data.error?.message || "Failed to reset Face ID");
      }
    } catch {
      setErrorMessage("Network error resetting Face ID.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Face ID Biometrics
                {isEnrolled && (
                  <Badge variant="success" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enrolled
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Register your facial biometric template for touchless 2-factor attendance verification.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEnrolled && !isScanning && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                disabled={submitting}
                onClick={handleResetFaceId}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Reset Face ID
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : isScanning ? (
          /* Live Camera Viewfinder for Enrollment */
          <div className="space-y-4">
            <div className="relative mx-auto max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-emerald-500/40">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Facial Alignment Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-64 rounded-[50%] border-2 border-dashed border-emerald-400/80 animate-pulse flex items-center justify-center">
                  <div className="w-48 h-60 rounded-[50%] border border-emerald-300/30" />
                </div>
              </div>

              {/* Top guidance bar */}
              <div className="absolute top-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md rounded-lg p-2 text-center text-xs text-emerald-300 font-medium border border-emerald-500/20">
                {statusMessage || "Align your face within the green oval"}
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs max-w-sm mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopCamera}
                disabled={submitting}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCaptureAndEnroll}
                disabled={submitting}
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    Capture & Enroll
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : isEnrolled ? (
          /* Enrolled Status View */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-slate-900">
                  Biometric Profile Active
                </h4>
                <p className="text-xs text-slate-500">
                  Enrolled on: {enrolledAt ? new Date(enrolledAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Active"}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
                  <Sparkles className="w-3 h-3" />
                  Ready for 1-tap Face Attendance verification
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStartCamera}
              className="text-xs shrink-0 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-Scan Face
            </Button>
          </div>
        ) : (
          /* Not Enrolled Call-to-Action View */
          <div className="text-center py-6 px-4 space-y-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ScanFace className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-sm font-bold text-slate-900">
                Set Up Face ID Attendance
              </h4>
              <p className="text-xs text-slate-500">
                Enable touchless attendance marking by capturing a quick reference scan of your face.
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs max-w-sm mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleStartCamera}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 px-4"
            >
              <Camera className="w-3.5 h-3.5" />
              Register My Face ID
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
