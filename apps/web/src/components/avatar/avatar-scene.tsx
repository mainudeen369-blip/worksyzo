'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { LoopRepeat, type AnimationAction, type Group } from 'three';

/** Bundled cartoon robot — no external sites (Ready Player Me blocked on some networks). */
export const DEFAULT_AVATAR_GLB =
  process.env.NEXT_PUBLIC_AVATAR_GLB_URL ?? '/avatars/worksyzo-bot.glb';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

interface AvatarModelProps {
  mood: AvatarMood;
  url: string;
}

function playAction(action: AnimationAction | null | undefined, loop = true) {
  if (!action) return undefined;
  action.reset().fadeIn(0.25);
  if (loop) {
    action.setLoop(LoopRepeat, Infinity);
  } else {
    action.setLoop(LoopRepeat, 1);
    action.clampWhenFinished = true;
  }
  action.play();
  return () => {
    action.fadeOut(0.25);
  };
}

function AvatarModel({ mood, url }: AvatarModelProps) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions } = useAnimations(gltf.animations, group);
  const talkPhase = useRef(0);

  useEffect(() => {
    const a = actions;
    let cleanup: (() => void) | undefined;

    if (mood === 'celebrate') {
      cleanup = playAction(a.Jump ?? a.ThumbsUp ?? a.Wave, false);
    } else if (mood === 'talking') {
      cleanup = playAction(a.Wave ?? a.Yes ?? a.Idle);
    } else if (mood === 'thinking') {
      cleanup = playAction(a.Walking ?? a.Idle);
    } else if (mood === 'success') {
      cleanup = playAction(a.ThumbsUp ?? a.Yes ?? a.Wave, false);
    } else {
      cleanup = playAction(a.Idle);
    }

    return () => cleanup?.();
  }, [actions, mood]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    if (mood === 'thinking') {
      group.current.rotation.y = Math.sin(t * 0.8) * 0.25;
    } else if (mood === 'talking') {
      talkPhase.current += delta * 8;
      group.current.rotation.y = Math.sin(talkPhase.current) * 0.08;
      group.current.position.y = -1.05 + Math.sin(t * 12) * 0.04;
      group.current.scale.setScalar(0.95 + Math.sin(t * 10) * 0.02);
    } else if (mood === 'celebrate') {
      group.current.rotation.y += delta * 2.2;
      group.current.position.y = -1.05 + Math.abs(Math.sin(t * 6)) * 0.12;
    } else if (mood === 'success') {
      group.current.position.y = -1.05 + Math.sin(t * 4) * 0.05;
    } else {
      group.current.rotation.y = Math.sin(t * 0.4) * 0.06;
      group.current.position.y = -1.05 + Math.sin(t * 1.2) * 0.02;
      group.current.scale.setScalar(0.95);
    }
  });

  return (
    <group ref={group} dispose={null} position={[0, -1.05, 0]} scale={0.95}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarFallback() {
  return (
    <mesh position={[0, 0.2, 0]}>
      <sphereGeometry args={[0.55, 32, 32]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.2} roughness={0.35} />
    </mesh>
  );
}

interface AvatarSceneProps {
  mood: AvatarMood;
  avatarUrl?: string;
  className?: string;
}

export function AvatarScene({ mood, avatarUrl = DEFAULT_AVATAR_GLB, className }: AvatarSceneProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e3b82 55%, #1e293b 100%)',
      }}
    >
      <Canvas camera={{ position: [0, 1.35, 2.4], fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} />
        <directionalLight position={[-2, 2, -2]} intensity={0.4} color="#93c5fd" />
        <pointLight position={[0, 2, 1]} intensity={0.5} color="#38bdf8" />
        <hemisphereLight args={['#dbeafe', '#1e293b', 0.55]} />
        <Suspense fallback={<AvatarFallback />}>
          <AvatarModel mood={mood} url={avatarUrl} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.4}
          maxPolarAngle={Math.PI / 2}
          target={[0, 0.75, 0]}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(DEFAULT_AVATAR_GLB);
