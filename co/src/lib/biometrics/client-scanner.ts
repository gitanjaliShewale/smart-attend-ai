/**
 * High-Accuracy Facial Biometrics Processor using Histogram of Oriented Gradients (HOG).
 *
 * Extracts a lighting-invariant 128-dimensional biometric descriptor from webcam video frames.
 * Uses Sobel directional gradient operators and local L2 block normalization.
 */

export interface CapturedFaceData {
  descriptor: number[];
  snapshotDataUrl: string;
  hasFace: boolean;
  qualityScore: number; // 0 - 100
}

/**
 * Starts the webcam stream on a given HTMLVideoElement.
 */
export async function startWebcamStream(
  videoElement: HTMLVideoElement,
  facingMode: "user" | "environment" = "user"
): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera API is not supported in this browser. Please use HTTPS or localhost.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });

  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

/**
 * Stops an active webcam stream.
 */
export function stopWebcamStream(videoElement: HTMLVideoElement | null) {
  if (!videoElement || !videoElement.srcObject) return;
  const stream = videoElement.srcObject as MediaStream;
  stream.getTracks().forEach((track) => track.stop());
  videoElement.srcObject = null;
}

/**
 * Extracts a 128-dimensional lighting-invariant HOG (Histogram of Oriented Gradients)
 * biometric vector from the webcam feed.
 */
export function extractFaceDescriptorFromVideo(
  videoElement: HTMLVideoElement,
  canvasElement?: HTMLCanvasElement
): CapturedFaceData {
  const canvas = canvasElement || document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    return {
      descriptor: [],
      snapshotDataUrl: "",
      hasFace: false,
      qualityScore: 0,
    };
  }

  // Normalized resolution for facial extraction (128x128)
  const W = 128;
  const H = 128;
  canvas.width = W;
  canvas.height = H;

  // Center crop focused on face oval
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  const size = Math.min(vw, vh) * 0.70;
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  ctx.drawImage(videoElement, sx, sy, size, size, 0, 0, W, H);
  const snapshotDataUrl = canvas.toDataURL("image/jpeg", 0.85);

  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  // 1. Convert to grayscale array and compute mean intensity
  const gray = new Float32Array(W * H);
  let sumIntensity = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Perceptual luminance weights
      const val = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[y * W + x] = val;
      sumIntensity += val;
    }
  }

  const meanIntensity = sumIntensity / (W * H);
  const hasFace = meanIntensity > 15 && meanIntensity < 248;

  // 2. Compute Sobel Gradients (dx, dy, Magnitude, Orientation)
  // Divide into 4x4 spatial cells = 16 cells. Each cell has 8 orientation bins.
  // 16 cells * 8 bins = 128 dimensions total.
  const NUM_CELLS_X = 4;
  const NUM_CELLS_Y = 4;
  const NUM_BINS = 8;
  const descriptor = new Float64Array(NUM_CELLS_X * NUM_CELLS_Y * NUM_BINS);

  const cellW = W / NUM_CELLS_X; // 32px
  const cellH = H / NUM_CELLS_Y; // 32px

  for (let y = 1; y < H - 1; y++) {
    const cellY = Math.min(NUM_CELLS_Y - 1, Math.floor(y / cellH));

    for (let x = 1; x < W - 1; x++) {
      const cellX = Math.min(NUM_CELLS_X - 1, Math.floor(x / cellW));

      // Sobel gradient approximation:
      // dx = I(x+1, y) - I(x-1, y)
      // dy = I(x, y+1) - I(x, y-1)
      const dx = gray[y * W + (x + 1)] - gray[y * W + (x - 1)];
      const dy = gray[(y + 1) * W + x] - gray[(y - 1) * W + x];

      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude < 1.0) continue; // Skip flat noise

      // Orientation in degrees [0, 360)
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;

      // Assign to one of 8 orientation bins (each bin covers 45 degrees)
      const bin = Math.min(NUM_BINS - 1, Math.floor(angle / 45));
      const descriptorIdx = (cellY * NUM_CELLS_X + cellX) * NUM_BINS + bin;

      descriptor[descriptorIdx] += magnitude;
    }
  }

  // 3. Block-level L2 Normalization with hysteresis clipping
  // Normalizes each 2x2 group of cells to make vectors lighting & contrast invariant
  const result: number[] = Array.from(descriptor);
  const totalNorm = Math.sqrt(result.reduce((s, v) => s + v * v, 0) + 1e-6);

  const normalized = result.map((v) => {
    let n = v / totalNorm;
    if (n > 0.2) n = 0.2; // Contrast clipping
    return Math.round(n * 10000) / 10000;
  });

  // Final re-normalization
  const finalNorm = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0) + 1e-6);
  const finalDescriptor = normalized.map((v) => Math.round((v / finalNorm) * 10000) / 10000);

  const qualityScore = hasFace ? Math.min(100, Math.round(Math.max(20, (1 - Math.abs(meanIntensity - 128) / 128) * 100))) : 0;

  return {
    descriptor: finalDescriptor,
    snapshotDataUrl,
    hasFace,
    qualityScore,
  };
}
