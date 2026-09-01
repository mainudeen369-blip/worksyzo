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

/** Human female assistant with face & eyes (Mixamo Michelle, bundled locally). */
export const DEFAULT_AVATAR_GLB =
  process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? '/avatars/worksyzo-michelle.glb';

export const LEGACY_CARTOON_GLB = '/avatars/worksyzo-assistant.glb';
export const LEGACY_ROBOT_GLB = '/avatars/worksyzo-bot.glb';
export const LEGACY_XBOT_GLB = '/avatars/worksyzo-human.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

/** Bust portrait — eyes and face centered in panel. */
const PORTRAIT = {
  position: [0, 0.64, 1.12] as [number, number, number],
  fov: 26,
  lookAt: [0, 0.64, 0] as [number, number, number],
};

function isGobkitAvatar(url: string): boolean {
  return url.includes('assistant') || url.includes('minion');
}

function isHumanoidAvatar(url: string): boolean {
  return (
    url.includes('human') ||
    url.includes('michelle') ||
    url.includes('xbot') ||
    url.includes('bot.glb')
  );
}

function isMichelleAvatar(url: string): boolean {
  return url.includes('michelle');
}

type ActionMap = Record<string, AnimationAction | null>;

function firstAction(actions: ActionMap, ...keys: string[]) {
  for (const key of keys) {
    const action = actions[key];
    if (action) return action;
  }
  return Object.values(actions).find(Boolean);
}

function moodAction(actions: ActionMap, mood: AvatarMood) {
  switch (mood) {
    case 'celebrate':
      return firstAction(actions, 'agree', 'wave', 'thumbs_up', 'punch', 'walk', 'idle');
    case 'talking':
      return firstAction(actions, 'agree', 'idle', 'walk');
    case 'thinking':
      return firstAction(actions, 'headShake', 'idle_turn', 'sad_pose', 'idle');
    case 'success':
      return firstAction(actions, 'agree', 'thumbs_up', 'wave', 'idle');
    default:
      return firstAction(actions, 'idle', 'walk');
  }
}

function useCenteredScene(scene: Object3D, targetHeight = 1.85, faceCamera = false) {
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
    scene.scale.setScalar(targetHeight / height);
    scene.rotation.set(0, faceCamera ? Math.PI : 0, 0);
  }, [scene, targetHeight, faceCamera]);
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.3);
  action.setLoop(LoopRepeat, loop ? Infinity : 1);
  if (!loop) action.clampWhenFinished = true;
  action.play();
  return () => {
    action.fadeOut(0.3);
  };
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

function HumanoidAvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions } = useAnimations(gltf.animations, group);
  const michelle = isMichelleAvatar(url);
  useCenteredScene(gltf.scene, michelle ? 2.05 : 1.9, michelle);

  useEffect(() => {
    const action = moodAction(actions, mood);
    const loop = mood !== 'success';
    const cleanup = playAction(action, loop);
    return () => cleanup?.();
  }, [actions, mood]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.6) * 0.1;
    } else if (mood === 'talking') {
      group.current.rotation.y = Math.sin(t * 2.5) * 0.06;
      group.current.position.y = Math.sin(t * 9) * 0.012;
    } else if (mood === 'celebrate') {
      group.current.rotation.y += delta * 0.8;
    } else {
      group.current.rotation.y = Math.sin(t * 0.3) * 0.03;
      group.current.position.y = Math.sin(t * 1.0) * 0.008;
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function GobkitAvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const mixer = useRef<AnimationMixer | null>(null);
  const active = useRef<AnimationAction | null>(null);
  useCenteredScene(gltf.scene, 1.5);

  const clips = useMemo(() => buildGobkitClips(gltf.animations[0]), [gltf.animations]);

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
      mood === 'celebrate' || mood === 'success' || mood === 'talking' || mood === 'thinking'
        ? clips.attack
        : clips.idle;

    const action = m.clipAction(pick);
    const loop = mood !== 'success';
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
    if (mood === 'talking') group.current.position.y = Math.sin(t * 10) * 0.012;
    else if (mood === 'thinking') group.current.rotation.y = Math.sin(t * 0.9) * 0.08;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarModel({ mood, url }: AvatarModelProps) {
  if (isGobkitAvatar(url)) return <GobkitAvatarModel mood={mood} url={url} />;
  return <HumanoidAvatarModel mood={mood} url={url} />;
}

function AvatarFallback() {
  return (
    <group position={[0, 0.35, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#fcd9bd" />
      </mesh>
      <mesh position={[-0.06, 0.44, 0.16]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.06, 0.44, 0.16]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <capsuleGeometry args={[0.16, 0.42, 8, 16]} />
        <meshStandardMaterial color="#6366f1" />
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
  const human = isHumanoidAvatar(avatarUrl) || !isGobkitAvatar(avatarUrl);
  const camZ = variant === 'compact' ? PORTRAIT.position[2] - 0.25 : PORTRAIT.position[2];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: human
          ? 'linear-gradient(165deg, #0f172a 0%, #334155 38%, #1e1b4b 100%)'
          : 'linear-gradient(165deg, #1e1b4b 0%, #6d28d9 42%, #0f172a 100%)',
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
        <ambientLight intensity={1.2} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.6} />
        <directionalLight position={[-2, 2, 1]} intensity={0.35} color="#bfdbfe" />
        <pointLight position={[0, 1.4, 1.8]} intensity={0.5} color="#fef3c7" />
        <hemisphereLight args={['#f8fafc', '#312e81', 0.55]} />
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
useGLTF.preload(LEGACY_XBOT_GLB);
