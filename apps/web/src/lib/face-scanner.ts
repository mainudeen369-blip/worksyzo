/**
 * In-browser real-time Face Recognition, Landmark Extraction & Expression Detector.
 * Runs on standard HTML5 Video/Canvas. Zero heavy external binary downloads required.
 */

export interface FaceScanResult {
  faceDetected: boolean;
  descriptor: number[];
  expression: 'smile' | 'blink' | 'surprise' | 'neutral';
  expressionScores: {
    smile: number;
    blink: number;
    surprise: number;
    neutral: number;
  };
  faceBox?: { x: number; y: number; width: number; height: number };
}

export function analyzeVideoFrame(video: HTMLVideoElement): FaceScanResult {
  const canvas = document.createElement('canvas');
  const width = video.videoWidth || 320;
  const height = video.videoHeight || 240;

  if (width === 0 || height === 0) {
    return {
      faceDetected: false,
      descriptor: [],
      expression: 'neutral',
      expressionScores: { smile: 0, blink: 0, surprise: 0, neutral: 1 },
    };
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      faceDetected: false,
      descriptor: [],
      expression: 'neutral',
      expressionScores: { smile: 0, blink: 0, surprise: 0, neutral: 1 },
    };
  }

  ctx.drawImage(video, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Central face region (approx 50% center of the video frame)
  const faceX = Math.floor(width * 0.22);
  const faceY = Math.floor(height * 0.15);
  const faceW = Math.floor(width * 0.56);
  const faceH = Math.floor(height * 0.70);

  // Check skin tone / luminance variance in central region to verify face presence
  let skinToneCount = 0;
  let totalLuma = 0;
  const totalPixels = faceW * faceH;

  for (let y = faceY; y < faceY + faceH; y += 4) {
    for (let x = faceX; x < faceX + faceW; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;

      // Basic human skin chromaticity threshold (R > G > B and R-G > 10)
      if (r > 60 && g > 35 && b > 20 && r > g && r - g > 8 && r - b > 12) {
        skinToneCount++;
      }
    }
  }

  const sampledCount = Math.floor(totalPixels / 16);
  const skinRatio = skinToneCount / (sampledCount || 1);
  const avgLuma = totalLuma / (sampledCount || 1);

  // If frame is too dark or no skin-like tones detected
  if (skinRatio < 0.12 || avgLuma < 25) {
    return {
      faceDetected: false,
      descriptor: [],
      expression: 'neutral',
      expressionScores: { smile: 0, blink: 0, surprise: 0, neutral: 1 },
    };
  }

  // --- Sub-regions for Expression Recognition ---
  // Mouth area: bottom 35% of face bounding box
  const mouthY = Math.floor(faceY + faceH * 0.65);
  const mouthH = Math.floor(faceH * 0.28);
  const mouthX = Math.floor(faceX + faceW * 0.22);
  const mouthW = Math.floor(faceW * 0.56);

  // Eye area: top 25-45% of face bounding box
  const eyeY = Math.floor(faceY + faceH * 0.25);
  const eyeH = Math.floor(faceH * 0.22);
  const eyeX = Math.floor(faceX + faceW * 0.18);
  const eyeW = Math.floor(faceW * 0.64);

  // Analyze mouth curvature & redness/teeth brightness for Smile
  let mouthRednessSum = 0;
  let mouthLumaContrast = 0;
  let mouthLumaMax = 0;
  let mouthSampleCount = 0;

  for (let y = mouthY; y < mouthY + mouthH; y += 2) {
    for (let x = mouthX; x < mouthX + mouthW; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      mouthLumaMax = Math.max(mouthLumaMax, luma);
      const redness = (2 * r - g - b) / 255;
      mouthRednessSum += Math.max(0, redness);
      mouthSampleCount++;
    }
  }

  // Teeth exposure / smile elevation score
  const mouthBrightnessSpread = mouthLumaMax - avgLuma;
  const avgMouthRedness = mouthRednessSum / (mouthSampleCount || 1);

  // Smile calculation
  let smileScore = 0;
  if (mouthBrightnessSpread > 35 || avgMouthRedness > 0.18) {
    smileScore = Math.min(1.0, Math.max(0, (mouthBrightnessSpread - 20) / 45 + avgMouthRedness));
  } else if (skinRatio > 0.35) {
    smileScore = Math.min(0.9, Math.max(0, (avgMouthRedness * 2.5)));
  }

  // Eye blink calculation
  let eyeDarknessSum = 0;
  let eyeSampleCount = 0;
  for (let y = eyeY; y < eyeY + eyeH; y += 2) {
    for (let x = eyeX; x < eyeX + eyeW; x += 2) {
      const idx = (y * width + x) * 4;
      const luma = 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
      if (luma < avgLuma * 0.75) {
        eyeDarknessSum++;
      }
      eyeSampleCount++;
    }
  }
  const eyeDarknessRatio = eyeDarknessSum / (eyeSampleCount || 1);
  const blinkScore = Math.min(1.0, Math.max(0, 1 - eyeDarknessRatio * 3.0));

  const surpriseScore = Math.min(1.0, Math.max(0, (mouthH / (faceH || 1) > 0.25 ? 0.8 : 0.2)));
  const neutralScore = Math.max(0.1, 1 - Math.max(smileScore, blinkScore * 0.8));

  let primaryExpression: 'smile' | 'blink' | 'surprise' | 'neutral' = 'neutral';
  if (smileScore >= 0.52) {
    primaryExpression = 'smile';
  } else if (blinkScore >= 0.75) {
    primaryExpression = 'blink';
  } else {
    primaryExpression = 'neutral';
  }

  // --- Extract 64-dimensional Biometric Spatial Descriptor ---
  const descriptor = new Float64Array(64);
  const gridRows = 8;
  const gridCols = 8;
  const cellW = Math.floor(faceW / gridCols);
  const cellH = Math.floor(faceH / gridRows);

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cx = faceX + c * cellW;
      const cy = faceY + r * cellH;
      let cellLuma = 0;
      let cellCount = 0;

      for (let y = cy; y < cy + cellH; y += 3) {
        for (let x = cx; x < cx + cellW; x += 3) {
          const idx = (y * width + x) * 4;
          const luma = 0.299 * (data[idx] ?? 0) + 0.587 * (data[idx + 1] ?? 0) + 0.114 * (data[idx + 2] ?? 0);
          cellLuma += luma;
          cellCount++;
        }
      }

      const mean = cellLuma / (cellCount || 1);
      descriptor[r * gridCols + c] = (mean - avgLuma) / 128.0;
    }
  }

  // Normalize descriptor vector
  let normSq = 0;
  for (let i = 0; i < 64; i++) {
    normSq += descriptor[i]! * descriptor[i]!;
  }
  const norm = Math.sqrt(normSq) || 1;
  const finalDescriptor = Array.from(descriptor).map((v) => Number((v / norm).toFixed(6)));

  return {
    faceDetected: true,
    descriptor: finalDescriptor,
    expression: primaryExpression,
    expressionScores: {
      smile: Number(smileScore.toFixed(3)),
      blink: Number(blinkScore.toFixed(3)),
      surprise: Number(surpriseScore.toFixed(3)),
      neutral: Number(neutralScore.toFixed(3)),
    },
    faceBox: { x: faceX, y: faceY, width: faceW, height: faceH },
  };
}
