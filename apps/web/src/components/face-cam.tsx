'use client';

import { useEffect, useRef, useState } from 'react';
import { analyzeVideoFrame, type FaceScanResult } from '@/lib/face-scanner';

interface FaceCamProps {
  challengeInstruction: string;
  requiredExpression: 'smile' | 'blink' | 'surprise' | 'neutral';
  onVerified: (scan: FaceScanResult) => void;
  busy?: boolean;
}

export function FaceCam({
  challengeInstruction,
  requiredExpression,
  onVerified,
  busy = false,
}: FaceCamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanState, setScanState] = useState<FaceScanResult>({
    faceDetected: false,
    descriptor: [],
    expression: 'neutral',
    expressionScores: { smile: 0, blink: 0, surprise: 0, neutral: 1 },
  });
  const [matchProgress, setMatchProgress] = useState(0);
  const verifiedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animFrame: number = 0;

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamReady(true);
        }
      } catch (err) {
        setCameraError(
          'Camera access was denied or not available. Please allow camera permissions in your browser.',
        );
      }
    }

    void startCam();

    return () => {
      cancelAnimationFrame(animFrame);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!streamReady || busy || verifiedRef.current) return;

    let animId: number;
    let consecutiveMatches = 0;

    function loop() {
      if (!videoRef.current || verifiedRef.current) return;

      const result = analyzeVideoFrame(videoRef.current);
      setScanState(result);

      if (result.faceDetected) {
        let score = 0;
        if (requiredExpression === 'smile') {
          score = result.expressionScores.smile;
        } else if (requiredExpression === 'blink') {
          score = result.expressionScores.blink;
        } else {
          score = result.expressionScores.neutral;
        }

        const pct = Math.min(100, Math.round(score * 100));
        setMatchProgress(pct);

        // Require 3 consecutive frames with expression score >= 50%
        if (score >= 0.48) {
          consecutiveMatches++;
          if (consecutiveMatches >= 3 && !verifiedRef.current) {
            verifiedRef.current = true;
            onVerified(result);
            return;
          }
        } else {
          consecutiveMatches = Math.max(0, consecutiveMatches - 1);
        }
      } else {
        setMatchProgress(0);
        consecutiveMatches = 0;
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [streamReady, busy, requiredExpression, onVerified]);

  const expressionLabels: Record<string, string> = {
    smile: '😄 Smiling',
    blink: '😉 Blink / Eyes',
    neutral: '😐 Neutral',
    surprise: '😲 Surprise',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
      <div
        style={{
          position: 'relative',
          width: 280,
          height: 210,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#090d16',
          border: scanState.faceDetected ? '2px solid #3b82f6' : '2px dashed #4b5563',
          boxShadow: scanState.faceDetected ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror
          }}
        />

        {/* Biometric Scan HUD Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 99,
                background: scanState.faceDetected ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)',
                color: '#fff',
              }}
            >
              {scanState.faceDetected ? 'Face Locked' : 'Searching Face...'}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 99,
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#93c5fd',
              }}
            >
              {expressionLabels[scanState.expression] || 'Detecting'}
            </span>
          </div>

          {/* Central Face Target Brackets */}
          <div
            style={{
              alignSelf: 'center',
              width: 140,
              height: 140,
              borderRadius: '50%',
              border: `2px ${scanState.faceDetected ? 'solid' : 'dashed'} ${
                matchProgress >= 50 ? '#22c55e' : '#60a5fa'
              }`,
              opacity: 0.8,
              transition: 'all 0.2s',
              transform: `scale(${1 + matchProgress * 0.001})`,
            }}
          />

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: '0.75rem',
              color: '#e2e8f0',
              textAlign: 'center',
            }}
          >
            {challengeInstruction}
          </div>
        </div>
      </div>

      {cameraError ? (
        <p className="error" style={{ fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
          {cameraError}
        </p>
      ) : (
        <div style={{ width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
            <span>Expression Match</span>
            <strong style={{ color: matchProgress >= 50 ? '#22c55e' : '#3b82f6' }}>{matchProgress}%</strong>
          </div>
          <div
            style={{
              height: 6,
              width: '100%',
              background: '#1e293b',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${matchProgress}%`,
                background: matchProgress >= 50 ? 'linear-gradient(90deg, #3b82f6, #22c55e)' : '#3b82f6',
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
