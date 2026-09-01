'use client';

import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, useAnimations, useGLTF } from '@react-three/drei';
import {
  Box3,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type Group,
  type Object3D,
} from 'three';

/** Cartoon robot assistant — fully clothed mascot with expressive face (RobotExpressive). */
export const DEFAULT_AVATAR_GLB = '/avatars/worksyzo-bot.glb';

export const LEGACY_CARTOON_GLB = '/avatars/worksyzo-assistant.glb';
export const LEGACY_HUMAN_GLB = '/avatars/worksyzo-michelle.glb';
export const LEGACY_XBOT_GLB = '/avatars/worksyzo-human.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

/** Front bust portrait — cartoon face centered, shoulders visible. */
const PORTRAIT = {
  position: [0, 0.5, 1.22] as [number, number, number],
  fov: 30,
  lookAt: [0, 0.48, 0] as [number, number, number],
};

const BLOCKED_MODEL_HINTS = ['michelle', 'assistant', 'minion', 'human', 'xbot'];

/** Always use the cartoon robot — never load human/minion models. */
export function resolveAvatarUrl(url?: string): string {
  const raw = (url ?? process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? DEFAULT_AVATAR_GLB).split('?')[0] ?? '';
  if (!raw || BLOCKED_MODEL_HINTS.some((hint) => raw.includes(hint))) return DEFAULT_AVATAR_GLB;
  return raw.includes('bot') ? raw : DEFAULT_AVATAR_GLB;
}

type ActionMap = Record<string, AnimationAction | null>;

function firstAction(actions: ActionMap, ...keys: string[]) {
  for (const key of keys) {
    const action = actions[key];
    if (action) return action;
  }
  return Object.values(actions).find(Boolean);
}

/** Calm poses only — no dance, walk, or run loops. */
function robotMoodAction(actions: ActionMap, mood: AvatarMood) {
  switch (mood) {
    case 'celebrate':
    case 'success':
      return firstAction(actions, 'ThumbsUp', 'Yes', 'Wave', 'Idle', 'Standing');
    default:
      return firstAction(actions, 'Idle', 'Standing');
  }
}

function useCenteredScene(scene: Object3D, targetHeight = 1.72) {
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
    scene.rotation.set(0, 0, 0);
  }, [scene, targetHeight]);
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.35);
  action.setLoop(LoopRepeat, loop ? Infinity : 1);
  if (!loop) action.clampWhenFinished = true;
  action.play();
  return () => {
    action.fadeOut(0.35);
  };
}

interface CartoonRobotModelProps {
  mood: AvatarMood;
  url: string;
}

function CartoonRobotModel({ mood, url }: CartoonRobotModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions } = useAnimations(gltf.animations, group);
  useCenteredScene(gltf.scene, 1.72);

  useEffect(() => {
    const action = robotMoodAction(actions, mood);
    const loop = mood !== 'success' && mood !== 'celebrate';
    const cleanup = playAction(action, loop);
    return () => cleanup?.();
  }, [actions, mood]);

  useFrame((state) => {
    if (!group.current) return;
    if (mood === 'talking') {
      const t = state.clock.elapsedTime;
      group.current.position.y = Math.sin(t * 5) * 0.003;
      return;
    }
    group.current.rotation.set(0, 0, 0);
    group.current.position.y = 0;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarFallback() {
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.34, 0.3, 0.28]} />
        <meshStandardMaterial color="#6366f1" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[-0.08, 0.4, 0.15]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.08, 0.4, 0.15]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <capsuleGeometry args={[0.2, 0.35, 8, 16]} />
        <meshStandardMaterial color="#4f46e5" metalness={0.25} roughness={0.45} />
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
  avatarUrl,
  className,
  variant = 'stage',
  statusLabel,
}: AvatarSceneProps) {
  const modelUrl = resolveAvatarUrl(avatarUrl);
  const camZ = variant === 'compact' ? PORTRAIT.position[2] - 0.2 : PORTRAIT.position[2];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 30%, #312e81 0%, #1e1b4b 38%, #0f172a 100%)',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{
          position: [PORTRAIT.position[0], PORTRAIT.position[1], camZ],
          fov: PORTRAIT.fov,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ camera }) =>
          camera.lookAt(PORTRAIT.lookAt[0], PORTRAIT.lookAt[1], PORTRAIT.lookAt[2])
        }
      >
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} castShadow />
        <directionalLight position={[-2.5, 2, 1.5]} intensity={0.5} color="#c4b5fd" />
        <pointLight position={[0, 1.2, 1.6]} intensity={0.65} color="#a5f3fc" />
        <spotLight
          position={[0, 3, 2]}
          angle={0.45}
          penumbra={0.5}
          intensity={0.8}
          color="#fef3c7"
        />
        <Environment preset="city" environmentIntensity={0.35} />
        <ContactShadows
          position={[0, -0.82, 0]}
          opacity={0.5}
          scale={2.4}
          blur={2.2}
          far={1.4}
          color="#000000"
        />
        <Suspense fallback={<AvatarFallback />}>
          <CartoonRobotModel mood={mood} url={modelUrl} />
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
