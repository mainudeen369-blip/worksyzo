'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  AnimationMixer,
  AnimationUtils,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Group,
} from 'three';

/** Cartoon assistant (Gobkit CC0 minion) — bundled locally. */
export const DEFAULT_AVATAR_GLB =
  process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? '/avatars/worksyzo-assistant.glb';

export const LEGACY_ROBOT_GLB = '/avatars/worksyzo-bot.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

const CAMERA = {
  cartoon: {
    position: [0, 0.72, 3.1] as [number, number, number],
    fov: 28,
    target: [0, 0.52, 0] as [number, number, number],
    scale: 1.25,
    yOffset: -0.28,
  },
  robot: {
    position: [0, 1.05, 5.6] as [number, number, number],
    fov: 30,
    target: [0, 0.9, 0] as [number, number, number],
    scale: 0.48,
    yOffset: -0.75,
  },
};

function isCartoonAvatar(url: string): boolean {
  return url.includes('assistant') || url.includes('minion');
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.3);
  action.setLoop(LoopRepeat, loop ? Infinity : 1);
  if (!loop) action.clampWhenFinished = true;
  action.play();
  return () => action.fadeOut(0.3);
}

function buildGobkitClips(base?: AnimationClip) {
  if (!base) return null;
  return {
    idle: AnimationUtils.subclip(base, 'idle', 0, 29, 24),
    attack: AnimationUtils.subclip(base, 'attack', 30, 59, 24),
  };
}

interface AvatarModelProps {
  mood: AvatarMood;
  url: string;
}

function RobotAvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions } = useAnimations(gltf.animations, group);
  const profile = CAMERA.robot;

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
    const baseY = profile.yOffset;

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
    group.current.scale.setScalar(profile.scale);
  });

  return (
    <group ref={group} dispose={null} position={[0, profile.yOffset, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function CartoonAvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const mixer = useRef<AnimationMixer | null>(null);
  const active = useRef<AnimationAction | null>(null);
  const profile = CAMERA.cartoon;

  const clips = useMemo(
    () => buildGobkitClips(gltf.animations[0]),
    [gltf.animations],
  );

  useEffect(() => {
    if (!group.current) return;
    mixer.current = new AnimationMixer(group.current);
    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, [gltf]);

  useEffect(() => {
    const m = mixer.current;
    if (!m || !clips) return;

    active.current?.fadeOut(0.25);
    const pick =
      mood === 'celebrate' || mood === 'success'
        ? clips.attack
        : mood === 'talking' || mood === 'thinking'
          ? clips.attack
          : clips.idle;

    const action = m.clipAction(pick);
    const loop = mood === 'idle' || mood === 'thinking' || mood === 'talking';
    action.reset().fadeIn(0.25);
    action.setLoop(LoopRepeat, loop ? Infinity : 1);
    if (!loop) action.clampWhenFinished = true;
    action.play();
    active.current = action;

    return () => {
      action.fadeOut(0.25);
    };
  }, [clips, mood]);

  useFrame((state, delta) => {
    mixer.current?.update(delta);
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const baseY = profile.yOffset;

    if (mood === 'talking') {
      group.current.position.y = baseY + Math.sin(t * 10) * 0.02;
      group.current.rotation.z = Math.sin(t * 8) * 0.03;
    } else if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.9) * 0.12;
    } else if (mood === 'celebrate') {
      group.current.rotation.y = Math.sin(t * 4) * 0.15;
      group.current.position.y = baseY + Math.abs(Math.sin(t * 6)) * 0.06;
    } else {
      group.current.rotation.y = Math.sin(t * 0.4) * 0.04;
      group.current.position.y = baseY + Math.sin(t * 1.2) * 0.01;
    }
    group.current.scale.setScalar(profile.scale);
  });

  return (
    <group ref={group} dispose={null} position={[0, profile.yOffset, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarModel({ mood, url }: AvatarModelProps) {
  if (isCartoonAvatar(url)) return <CartoonAvatarModel mood={mood} url={url} />;
  return <RobotAvatarModel mood={mood} url={url} />;
}

function AvatarFallback() {
  return (
    <mesh position={[0, 0.55, 0]}>
      <capsuleGeometry args={[0.28, 0.65, 8, 16]} />
      <meshStandardMaterial color="#f472b6" metalness={0.1} roughness={0.45} />
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
  const cartoon = isCartoonAvatar(avatarUrl);
  const profile = cartoon ? CAMERA.cartoon : CAMERA.robot;
  const camZ = variant === 'compact' ? profile.position[2] - 0.6 : profile.position[2];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: cartoon
          ? 'linear-gradient(165deg, #1e1b4b 0%, #6d28d9 42%, #0f172a 100%)'
          : 'linear-gradient(165deg, #0c1222 0%, #1e3a8a 45%, #0f172a 100%)',
        borderRadius: variant === 'stage' ? '0' : '12px',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{
          position: [profile.position[0], profile.position[1], camZ],
          fov: profile.fov,
        }}
        dpr={[1, 1.5]}
        onCreated={({ camera }) => camera.lookAt(profile.target[0], profile.target[1], profile.target[2])}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 3]} intensity={1.35} />
        <directionalLight position={[-3, 3, -2]} intensity={0.4} color="#f9a8d4" />
        <pointLight position={[0, 2, 2]} intensity={0.5} color="#c4b5fd" />
        <hemisphereLight args={['#fce7f3', '#312e81', 0.45]} />
        <Suspense fallback={<AvatarFallback />}>
          <AvatarModel mood={mood} url={avatarUrl} />
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
