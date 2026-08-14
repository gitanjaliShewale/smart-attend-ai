import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StudentScanClient } from "@/components/student/StudentScanClient";

// ============================================================
// Mock html5-qrcode
// ============================================================
let mockOnSuccess: ((text: string) => void) | null = null;
let mockStartPromise: Promise<void> = Promise.resolve();
let stopCalled = false;

vi.mock("html5-qrcode", () => {
  return {
    Html5Qrcode: class {
      isScanning = true;
      constructor() {}
      start(facing: any, config: any, onSuccess: any) {
        mockOnSuccess = onSuccess;
        return mockStartPromise;
      }
      stop() {
        stopCalled = true;
        this.isScanning = false;
        return Promise.resolve();
      }
    },
  };
});

describe("StudentScanClient Component (Phase 9)", () => {
  beforeEach(() => {
    mockOnSuccess = null;
    mockStartPromise = Promise.resolve();
    stopCalled = false;
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: "present" } }),
      })
    );

    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: vi.fn() },
    });
  });

  it("extracts token from a scanned URL and calls /api/attendance/mark", async () => {
    // Set localStorage device UUID
    localStorage.setItem("attendqr_device_uuid", "mock-device-uuid-12345");

    render(<StudentScanClient />);

    // Wait for the scanner viewfinder to mount and start
    await waitFor(() => {
      expect(mockOnSuccess).toBeDefined();
    });

    // Simulate successful QR decode containing a valid URL with query parameter t
    if (mockOnSuccess) {
      await act(async () => {
        await mockOnSuccess!("http://localhost:3000/attendance/scan?t=cryptic-token-987");
      });
    }

    // Verify stop was called to prevent multiple scan runs
    expect(stopCalled).toBe(true);

    // Verify fetch submission payload containing both token and deviceUuid
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/attendance/mark",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "cryptic-token-987", deviceUuid: "mock-device-uuid-12345" }),
      })
    );

    // Verify success completion state rendered
    await waitFor(() => {
      expect(screen.getByText("Attendance Logged Successfully!")).toBeInTheDocument();
    });
  });

  it("handles malformed QR content gracefully showing error page", async () => {
    render(<StudentScanClient />);

    await waitFor(() => {
      expect(mockOnSuccess).toBeDefined();
    });

    // Simulate scanning a QR code with an empty/malformed token
    if (mockOnSuccess) {
      await act(async () => {
        await mockOnSuccess!("http://localhost:3000/attendance/scan?t=");
      });
    }

    // Verify error page state rendered with message
    await waitFor(() => {
      expect(screen.getByText("Scanning Halted")).toBeInTheDocument();
      expect(screen.getByText(/Invalid QR code scanned/)).toBeInTheDocument();
    });
  });

  it("handles camera stream failure states gracefully", async () => {
    // Mock scanner start to throw an error (e.g. permission denied)
    mockStartPromise = Promise.reject(new Error("NotAllowedError"));

    render(<StudentScanClient />);

    // Verify error page state with camera warning
    await waitFor(() => {
      expect(screen.getByText("Scanning Halted")).toBeInTheDocument();
      expect(screen.getByText(/Camera permission denied/)).toBeInTheDocument();
    });
  });
});
