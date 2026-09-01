'use client';

import { Component, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import {
  Box3,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type Group,
  type Object3D,
} from 'three';

/** Cartoon robot assistant — fully clothed mascot (RobotExpressive, bundled locally). */
export const DEFAULT_AVATAR_GLB = '/avatars/worksyzo-bot.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

const PORTRAIT = {
  position: [0, 0.42, 2.05] as [number, number, number],
  fov: 34,
  lookAt: [0, 0.4, 0] as [number, number, number],
};

export function resolveAvatarUrl(url?: string): string {
  const raw = (url ?? DEFAULT_AVATAR_GLB).split('?')[0] ?? DEFAULT_AVATAR_GLB;
  if (raw.includes('bot')) return DEFAULT_AVATAR_GLB;
  return DEFAULT_AVATAR_GLB;
}

type ActionMap = Record<string, AnimationAction | null>;

function findAction(actions: ActionMap, ...keys: string[]) {
  const entries = Object.entries(actions);
  for (const key of keys) {
    const hit = entries.find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (hit?.[1]) return hit[1];
  }
  return Object.values(actions).find(Boolean);
}

function robotMoodAction(actions: ActionMap, mood: AvatarMood) {
  if (mood === 'celebrate' || mood === 'success') {
    return findAction(actions, 'ThumbsUp', 'Yes', 'Wave', 'Idle', 'Standing');
  }
  return findAction(actions, 'Idle', 'Standing');
}

function useCenteredScene(scene: Object3D, targetHeight = 1.65) {
  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());
    scene.position.sub(center);

    const size = box.getSize(new Vector3());
    const height = Math.max(size.y, 0.001);
    scene.scale.setScalar(targetHeight / height);
    scene.rotation.set(0, 0, 0);
  }, [scene, targetHeight]);
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.25);
  action.setLoop(LoopRepeat, loop ? Infinity : 1);
  if (!loop) action.clampWhenFinished = true;
  action.play();
  return () => {
    action.fadeOut(0.25);
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
  useCenteredScene(gltf.scene, 1.65);

  useEffect(() => {
    const action = robotMoodAction(actions, mood);
    const loop = mood !== 'success' && mood !== 'celebrate';
    const cleanup = playAction(action, loop);
    return () => cleanup?.();
  }, [actions, mood]);

  useFrame((state) => {
    if (!group.current) return;
    if (mood === 'talking') {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 5) * 0.004;
      return;
    }
    group.current.position.y = 0;
    group.current.rotation.y = 0;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/** Built-in cartoon robot — always renders even if GLB fails. */
function ProceduralRobot() {
  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.36, 0.32, 0.3]} />
        <meshStandardMaterial color="#6366f1" metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[-0.09, 0.44, 0.14]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.09, 0.44, 0.14]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.28, 0.16]}>
        <boxGeometry args={[0.14, 0.04, 0.02]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.38, 8, 16]} />
        <meshStandardMaterial color="#4f46e5" metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[-0.28, 0.1, 0]}>
        <capsuleGeometry args={[0.06, 0.22, 6, 12]} />
        <meshStandardMaterial color="#818cf8" />
      </mesh>
      <mesh position={[0.28, 0.1, 0]}>
        <capsuleGeometry args={[0.06, 0.22, 6, 12]} />
        <meshStandardMaterial color="#818cf8" />
      </mesh>
    </group>
  );
}

class AvatarModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <ProceduralRobot />;
    return this.props.children;
  }
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
  const camZ = variant === 'compact' ? PORTRAIT.position[2] - 0.3 : PORTRAIT.position[2];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 320,
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 28%, #4338ca 0%, #1e1b4b 45%, #0f172a 100%)',
        overflow: 'hidden',
      }}
    >
      <Canvas
        style={{ width: '100%', height: '100%', display: 'block' }}
        camera={{
          position: [PORTRAIT.position[0], PORTRAIT.position[1], camZ],
          fov: PORTRAIT.fov,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) =>
          camera.lookAt(PORTRAIT.lookAt[0], PORTRAIT.lookAt[1], PORTRAIT.lookAt[2])
        }
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={1.35} />
        <directionalLight position={[-2, 2, 1.5]} intensity={0.45} color="#c4b5fd" />
        <pointLight position={[0, 1.2, 2]} intensity={0.55} color="#a5f3fc" />
        <Suspense fallback={<ProceduralRobot />}>
          <AvatarModelErrorBoundary>
            <CartoonRobotModel mood={mood} url={modelUrl} />
          </AvatarModelErrorBoundary>
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
