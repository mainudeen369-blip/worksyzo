'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  AnimationMixer,
  AnimationUtils,
  Box3,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Group,
  type Object3D,
} from 'three';

/** Cartoon assistant (Gobkit CC0) — bundled locally. */
export const DEFAULT_AVATAR_GLB =
  process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? '/avatars/worksyzo-assistant.glb';

export const LEGACY_ROBOT_GLB = '/avatars/worksyzo-bot.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

/** Portrait camera — framed on head + upper body. */
const PORTRAIT = {
  position: [0, 0.42, 2.15] as [number, number, number],
  fov: 34,
  lookAt: [0, 0.38, 0] as [number, number, number],
};

function isCartoonAvatar(url: string): boolean {
  return url.includes('assistant') || url.includes('minion');
}

/** Center model at origin and scale so full character (face to feet) fits in view. */
function useCenteredScene(scene: Object3D, targetHeight = 1.55) {
  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    if (box.isEmpty()) return;

    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    scene.position.x -= center.x;
    scene.position.y -= center.y;
    scene.position.z -= center.z;

    const height = Math.max(size.y, 0.001);
    const scale = targetHeight / height;
    scene.scale.setScalar(scale);

    // Gobkit models face +Z; ensure character faces the camera on +Z axis.
    scene.rotation.y = 0;
  }, [scene, targetHeight]);
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
  useCenteredScene(gltf.scene, 1.65);

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

    if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.7) * 0.12;
    } else if (mood === 'talking') {
      group.current.rotation.y = Math.sin(t * 3) * 0.08;
      group.current.position.y = Math.sin(t * 11) * 0.02;
    } else if (mood === 'celebrate') {
      group.current.rotation.y += delta * 1.5;
      group.current.position.y = Math.abs(Math.sin(t * 5)) * 0.05;
    } else {
      group.current.rotation.y = Math.sin(t * 0.35) * 0.04;
      group.current.position.y = Math.sin(t * 1.1) * 0.01;
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function CartoonAvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const mixer = useRef<AnimationMixer | null>(null);
  const active = useRef<AnimationAction | null>(null);
  useCenteredScene(gltf.scene, 1.45);

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

    if (mood === 'talking') {
      group.current.position.y = Math.sin(t * 10) * 0.015;
      group.current.rotation.z = Math.sin(t * 8) * 0.02;
    } else if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.9) * 0.1;
    } else if (mood === 'celebrate') {
      group.current.rotation.y = Math.sin(t * 4) * 0.12;
      group.current.position.y = Math.abs(Math.sin(t * 6)) * 0.04;
    } else {
      group.current.rotation.y = Math.sin(t * 0.4) * 0.03;
    }
  });

  return (
    <group ref={group} dispose={null}>
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
    <group position={[0, 0.35, 0]}>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#c4b5fd" />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <capsuleGeometry args={[0.18, 0.45, 8, 16]} />
        <meshStandardMaterial color="#a78bfa" />
      </mesh>
    </group>
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
  const camZ = variant === 'compact' ? PORTRAIT.position[2] - 0.35 : PORTRAIT.position[2];

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
          position: [PORTRAIT.position[0], PORTRAIT.position[1], camZ],
          fov: PORTRAIT.fov,
        }}
        dpr={[1, 1.5]}
        onCreated={({ camera }) =>
          camera.lookAt(PORTRAIT.lookAt[0], PORTRAIT.lookAt[1], PORTRAIT.lookAt[2])
        }
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[2, 4, 3]} intensity={1.5} />
        <directionalLight position={[-2, 2, 1]} intensity={0.45} color="#f9a8d4" />
        <pointLight position={[0, 1.2, 2]} intensity={0.55} color="#e9d5ff" />
        <hemisphereLight args={['#fce7f3', '#312e81', 0.5]} />
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
