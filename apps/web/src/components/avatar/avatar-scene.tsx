'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { AvatarMood } from './avatar-types';

export type { AvatarMood } from './avatar-types';
export { DEFAULT_AVATAR_GLB, resolveAvatarUrl } from './avatar-types';

const CAMERA = {
  position: [0, 0.32, 2.6] as [number, number, number],
  fov: 38,
  lookAt: [0, 0.28, 0] as [number, number, number],
};

interface WorksyzoMascotProps {
  mood: AvatarMood;
}

/** Pure Three.js cartoon robot — no GLB download, always visible. */
function WorksyzoMascot({ mood }: WorksyzoMascotProps) {
  const root = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (root.current) {
      root.current.rotation.y = Math.sin(t * 0.35) * 0.08;
      root.current.position.y = Math.sin(t * 0.9) * 0.015;
    }
    if (mouth.current) {
      const talking = mood === 'talking';
      mouth.current.scale.y = talking ? 0.35 + Math.abs(Math.sin(t * 14)) * 0.65 : 0.35;
    }
    const blink = Math.sin(t * 2.1) > 0.96 ? 0.15 : 1;
    if (leftEye.current) leftEye.current.scale.y = blink;
    if (rightEye.current) rightEye.current.scale.y = blink;
  });

  return (
    <group ref={root} position={[0, -0.08, 0]}>
      {/* Antenna */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 12]} />
        <meshStandardMaterial color="#a5b4fc" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.8} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#6366f1" metalness={0.25} roughness={0.4} />
      </mesh>

      {/* Face visor */}
      <mesh position={[0, 0.42, 0.18]}>
        <sphereGeometry args={[0.24, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color="#312e81" metalness={0.5} roughness={0.25} />
      </mesh>

      {/* Eyes */}
      <mesh ref={leftEye} position={[-0.09, 0.46, 0.24]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#06b6d4" emissiveIntensity={0.9} />
      </mesh>
      <mesh ref={rightEye} position={[0.09, 0.46, 0.24]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#06b6d4" emissiveIntensity={0.9} />
      </mesh>

      {/* Mouth */}
      <mesh ref={mouth} position={[0, 0.3, 0.25]}>
        <boxGeometry args={[0.12, 0.04, 0.02]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.1, 16]} />
        <meshStandardMaterial color="#4f46e5" />
      </mesh>

      {/* Torso — fully covered suit */}
      <mesh position={[0, -0.08, 0]}>
        <capsuleGeometry args={[0.22, 0.42, 8, 16]} />
        <meshStandardMaterial color="#4338ca" metalness={0.2} roughness={0.45} />
      </mesh>

      {/* Chest badge */}
      <mesh position={[0, -0.02, 0.2]}>
        <circleGeometry args={[0.07, 24]} />
        <meshStandardMaterial color="#a5b4fc" emissive="#6366f1" emissiveIntensity={0.3} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.34, -0.02, 0]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.07, 0.28, 8, 12]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0.34, -0.02, 0]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.07, 0.28, 8, 12]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>

      {/* Base glow ring */}
      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.32, 32]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function SvgMascotFallback({ mood }: { mood: AvatarMood }) {
  const talking = mood === 'talking';
  return (
    <div className="worksyzo-svg-mascot" aria-hidden style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1rem',
      pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 200 260" width="100%" height="100%">
        <defs>
          <radialGradient id="wg" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#312e81" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="230" rx="55" ry="12" fill="#6366f1" opacity="0.25" />
        <rect x="72" y="130" width="56" height="80" rx="22" fill="#4338ca" />
        <rect x="38" y="138" width="22" height="58" rx="11" fill="#6366f1" />
        <rect x="140" y="138" width="22" height="58" rx="11" fill="#6366f1" />
        <circle cx="100" cy="88" r="48" fill="url(#wg)" />
        <rect x="62" y="72" width="76" height="42" rx="18" fill="#1e1b4b" opacity="0.85" />
        <circle cx="78" cy="88" r="9" fill="#22d3ee" />
        <circle cx="122" cy="88" r="9" fill="#22d3ee" />
        <ellipse
          cx="100"
          cy={talking ? 108 : 106}
          rx={talking ? 14 : 10}
          ry={talking ? 8 : 3}
          fill="#0f172a"
        />
        <line x1="100" y1="40" x2="100" y2="22" stroke="#a5b4fc" strokeWidth="4" />
        <circle cx="100" cy="18" r="7" fill="#22d3ee" />
      </svg>
    </div>
  );
}

interface AvatarSceneProps {
  mood: AvatarMood;
  avatarUrl?: string;
  className?: string;
  variant?: 'stage' | 'compact';
  statusLabel?: string;
}

export function AvatarScene({
  mood,
  className,
  variant = 'stage',
  statusLabel,
}: AvatarSceneProps) {
  const [webglOk, setWebglOk] = useState(true);
  const camZ = variant === 'compact' ? CAMERA.position[2] - 0.4 : CAMERA.position[2];

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const supported = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
      if (!supported) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  return (
    <div
      className={`worksyzo-avatar-stage${className ? ` ${className}` : ''}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 320,
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 28%, #4338ca 0%, #1e1b4b 45%, #0f172a 100%)',
        overflow: 'hidden',
      }}
    >
      <SvgMascotFallback mood={mood} />

      {webglOk ? (
        <Canvas
          className="worksyzo-avatar-canvas"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
          camera={{
            position: [CAMERA.position[0], CAMERA.position[1], camZ],
            fov: CAMERA.fov,
            near: 0.1,
            far: 50,
          }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(CAMERA.lookAt[0], CAMERA.lookAt[1], CAMERA.lookAt[2]);
            gl.setClearColor(0x000000, 0);
            gl.domElement.addEventListener('webglcontextlost', () => setWebglOk(false), { once: true });
          }}
        >
          <ambientLight intensity={1.1} />
          <directionalLight position={[2, 4, 3]} intensity={1.5} />
          <directionalLight position={[-2, 2, 2]} intensity={0.5} color="#c4b5fd" />
          <pointLight position={[0, 1, 2.5]} intensity={0.6} color="#a5f3fc" />
          <WorksyzoMascot mood={mood} />
        </Canvas>
      ) : null}

      {statusLabel ? (
        <div
          style={{
            position: 'absolute',
            left: '0.75rem',
            bottom: '0.75rem',
            zIndex: 2,
            padding: '0.25rem 0.65rem',
            borderRadius: 999,
            fontSize: '0.72rem',
            fontWeight: 700,
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          {statusLabel}
        </div>
      ) : null}
    </div>
  );
}
