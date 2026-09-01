'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { LoopRepeat, type AnimationAction, type Group } from 'three';

export const DEFAULT_AVATAR_GLB =
  process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? '/avatars/worksyzo-bot.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

const CAMERA = {
  stage: { position: [0, 1.05, 5.6] as [number, number, number], fov: 30, target: [0, 0.9, 0] as [number, number, number] },
  compact: { position: [0, 1.2, 4.2] as [number, number, number], fov: 34, target: [0, 0.85, 0] as [number, number, number] },
};

interface AvatarModelProps {
  mood: AvatarMood;
  url: string;
  scale: number;
  yOffset: number;
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.3);
  action.setLoop(loop ? LoopRepeat : LoopRepeat, loop ? Infinity : 1);
  if (!loop) action.clampWhenFinished = true;
  action.play();
  return () => action.fadeOut(0.3);
}

function AvatarModel({ mood, url, scale, yOffset }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions } = useAnimations(gltf.animations, group);

  useEffect(() => {
    const a = actions;
    let cleanup: (() => void) | undefined;
    if (mood === 'celebrate') cleanup = playAction(a.Jump ?? a.ThumbsUp ?? a.Wave, false);
    else if (mood === 'talking') cleanup = playAction(a.Wave ?? a.Yes ?? a.Idle);
    else if (mood === 'thinking') cleanup = playAction(a.Walking ?? a.Idle);
    else if (mood === 'success') cleanup = playAction(a.ThumbsUp ?? a.Yes, false);
    else cleanup = playAction(a.Idle);
    return () => cleanup?.();
  }, [actions, mood]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const baseY = yOffset;

    if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.7) * 0.18;
    } else if (mood === 'talking') {
      group.current.rotation.y = Math.sin(t * 3) * 0.1;
      group.current.position.y = baseY + Math.sin(t * 11) * 0.035;
    } else if (mood === 'celebrate') {
      group.current.rotation.y += delta * 1.8;
      group.current.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.1;
    } else {
      group.current.rotation.y = Math.sin(t * 0.35) * 0.05;
      group.current.position.y = baseY + Math.sin(t * 1.1) * 0.015;
    }
    group.current.scale.setScalar(scale);
  });

  return (
    <group ref={group} dispose={null} position={[0, yOffset, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarFallback() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <capsuleGeometry args={[0.35, 0.9, 8, 16]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.15} roughness={0.4} />
    </mesh>
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
  avatarUrl = DEFAULT_AVATAR_GLB,
  className,
  variant = 'stage',
  statusLabel,
}: AvatarSceneProps) {
  const cam = CAMERA[variant];
  const scale = variant === 'stage' ? 0.48 : 0.55;
  const yOffset = variant === 'stage' ? -0.75 : -0.85;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'linear-gradient(165deg, #0c1222 0%, #1e3a8a 45%, #0f172a 100%)',
        borderRadius: variant === 'stage' ? '0' : '12px',
        overflow: 'hidden',
      }}
    >
      <Canvas camera={{ position: cam.position, fov: cam.fov }} dpr={[1, 1.5]}>
        <ambientLight intensity={1} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />
        <directionalLight position={[-3, 3, -2]} intensity={0.35} color="#bfdbfe" />
        <pointLight position={[0, 2.5, 2]} intensity={0.45} color="#60a5fa" />
        <hemisphereLight args={['#e0f2fe', '#1e293b', 0.5]} />
        <Suspense fallback={<AvatarFallback />}>
          <AvatarModel mood={mood} url={avatarUrl} scale={scale} yOffset={yOffset} />
        </Suspense>
      </Canvas>
      {statusLabel ? (
        <div
          style={{
            position: 'absolute',
            left: '0.75rem',
            bottom: '0.75rem',
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

useGLTF.preload(DEFAULT_AVATAR_GLB);
