"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RenderTexture, useGLTF, useKTX2, useTexture, useVideoTexture } from "@react-three/drei";
import * as THREE from "three";
import siteContent from "@/data/site-content.json";
import type { SceneMotion } from "@/types/scene";
import { fullscreenVertex, heroFragment, mosaicFragment } from "@/components/scene-shaders";
import WorldwideScene from "@/components/worldwide-scene";
import { homeSession } from "@/lib/home-session";

interface SceneProps { motion: MutableRefObject<SceneMotion> }
interface PointerState { x: number; y: number; move: number; delta: number; down: boolean; previousX: number; startX: number; dragged: boolean; coarse: boolean }
interface SceneMedia { url: string; width: number; height: number; mimeType: string; video: { mp4Url: string } | null }
interface TrailPoint { x: number; y: number; age: number; force: number }
interface TrailState { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture; points: TrailPoint[] }

const VIDEO_POSITIONS: [number, number, number][] = [[8, -2, -40], [-8, 1, -55], [0, -2, -65]];
const IMAGE_POSITIONS: [number, number, number][] = [[-4, -5, -18], [-10, -.5, -30], [3, 2, -45]];
const VIDEO_SCALES = [1.4, 1.4, 3];
const IMAGE_SCALES = [.8, 1, 1.2];
const VIDEOS = (siteContent.mosaic as SceneMedia[]).filter((item) => item.mimeType.startsWith("video/")).slice(0, 3);
const IMAGES = (siteContent.mosaic as SceneMedia[]).filter((item) => item.mimeType.startsWith("image/")).slice(0, 3);

useGLTF.setDecoderPath("/draco/");

function usePointer(motion: MutableRefObject<SceneMotion>) {
  const pointer = useRef<PointerState>({ x: .5, y: .5, move: 0, delta: 0, down: false, previousX: 0, startX: 0, dragged: false, coarse: false });
  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const updateCoarsePointer = () => { pointer.current.coarse = coarsePointer.matches; };
    updateCoarsePointer();
    coarsePointer.addEventListener("change", updateCoarsePointer);
    const move = (event: PointerEvent) => {
      const state = pointer.current;
      state.x = event.clientX / window.innerWidth;
      state.y = 1 - event.clientY / window.innerHeight;
      state.move += 1;
      if (state.down && motion.current.footer > 0) {
        if (Math.abs(event.clientX - state.startX) >= 6) state.dragged = true;
        if (state.dragged) state.delta += event.clientX - state.previousX;
      }
      state.previousX = event.clientX;
    };
    const down = (event: PointerEvent) => {
      pointer.current.previousX = event.clientX;
      pointer.current.startX = event.clientX;
      pointer.current.dragged = false;
      const target = event.target;
      const interactive = target instanceof Element && target.closest("a,button,input,textarea,select");
      pointer.current.down = motion.current.footer > 0 && !interactive;
    };
    const up = () => { pointer.current.down = false; };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    return () => {
      coarsePointer.removeEventListener("change", updateCoarsePointer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [motion]);
  return pointer;
}

function useCover(width: number, height: number, multiplier = 1): [number, number, number] {
  const viewport = useThree((state) => state.viewport);
  const factor = viewport.aspect > width / height ? viewport.width / width : viewport.height / height;
  return [width * factor * multiplier, height * factor * multiplier, 1];
}

function createTrail(): TrailState {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas is needed to render the pointer trail.");
  context.fillStyle = "black";
  context.fillRect(0, 0, 1024, 1024);
  const texture = new THREE.CanvasTexture(canvas);
  return { canvas, context, texture, points: [] };
}

function updateTrail(trail: TrailState, delta: number) {
  const { context, points } = trail;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "black";
  context.fillRect(0, 0, 1024, 1024);
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    point.age += delta * 1000;
    if (point.age > 600) { points.splice(index, 1); continue; }
    let age = point.age / 180;
    if (point.age >= 180) age = 1 - (point.age - 180) / 420;
    const ease = Math.sqrt(1 - Math.pow(age - 1, 2));
    const radius = 1024 * .095 * ease * point.force;
    if (radius <= 0) continue;
    const x = point.x * 1024;
    const y = (1 - point.y) * 1024;
    const gradient = context.createRadialGradient(x, y, radius * .25, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,.1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.globalCompositeOperation = "difference";
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  trail.texture.needsUpdate = true;
}

function HeroShape({ motion, pointer }: SceneProps & { pointer: MutableRefObject<PointerState> }) {
  const texture = useKTX2("/textures/background-podium-shape.ktx2", "/basis/");
  const { size } = useThree();
  const scale = useCover(size.width, size.height);
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const trail = useMemo(() => createTrail(), []);
  const lastMove = useRef(0);
  const revealStarted = useRef<number | null>(null);
  const [restored] = useState(() => homeSession.loaded);
  const uniforms = useMemo(() => ({
    uIsMobile: { value: false }, uTime: { value: 0 }, uShapeReveal: { value: restored ? 1 : 0 },
    uScrollProgress: { value: 0 }, uPulseReveal: { value: restored ? 1 : 0 }, uScrollZposition: { value: 0 },
    uScrollVelocity: { value: 0 }, uFluidIntensity: { value: .6 }, uNoiseIntensity: { value: .6 },
    uBarrelIntensity: { value: 6 }, uUvScale: { value: 1.4 }, uPulseMult: { value: .2 },
    uBackgroundPodiumShapeTexture: { value: texture },
    uTextureShapeSize: { value: new THREE.Vector2((texture.image as { width: number; height: number }).width, (texture.image as { width: number; height: number }).height) },
    uMouseTexture: { value: trail.texture }, uResolution: { value: new THREE.Vector2() },
    uColorBeige: { value: new THREE.Color("#ffffff") }, uMeshSize: { value: new THREE.Vector2() },
  }), [texture, trail, restored]);
  useEffect(() => () => trail.texture.dispose(), [trail]);
  useFrame(({ clock, camera, size }, delta) => {
    if (!mesh.current || !material.current) return;
    const live = material.current.uniforms as typeof uniforms;
    if (revealStarted.current === null) revealStarted.current = clock.elapsedTime;
    const elapsed = THREE.MathUtils.clamp((clock.elapsedTime - revealStarted.current) / .9, 0, 1);
    let reveal = 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
    if (elapsed < .5) reveal = 4 * Math.pow(elapsed, 3);
    if (restored || homeSession.loaded) reveal = 1;
    if (elapsed >= 1) homeSession.loaded = true;
    const next = pointer.current;
    if (lastMove.current !== next.move) {
      lastMove.current = next.move;
      const previous = trail.points[trail.points.length - 1];
      let force = .5;
      if (previous) force = Math.max(.5, Math.min(10000 * (Math.pow(previous.x - next.x, 2) + Math.pow(previous.y - next.y, 2)), 1));
      trail.points.push({ x: next.x, y: next.y, age: 0, force });
    }
    updateTrail(trail, delta);
    const current = motion.current;
    live.uTime.value = clock.elapsedTime;
    live.uShapeReveal.value = reveal;
    live.uPulseReveal.value = Math.pow(reveal, 12);
    live.uScrollProgress.value = current.hero;
    live.uScrollZposition.value = current.hero;
    live.uScrollVelocity.value = current.velocity;
    live.uResolution.value.set(size.width, size.height);
    live.uMeshSize.value.set(scale[0], scale[1]);
    mesh.current.position.z = current.hero * camera.position.z;
    mesh.current.visible = current.hero < .999;
  });
  return <mesh ref={mesh} scale={scale} renderOrder={1}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={fullscreenVertex} fragmentShader={heroFragment} transparent depthWrite={false} />
  </mesh>;
}

function useMediaMotion(mesh: MutableRefObject<THREE.Mesh | null>, motion: MutableRefObject<SceneMotion>, position: [number, number, number], pointer: MutableRefObject<PointerState>) {
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const item = mesh.current;
    if (!item) return;
    const travel = motion.current.mosaic * 70;
    let spread = 1;
    if (pointer.current.coarse) spread = .5;
    const x = position[0] * spread;
    const y = position[1] * spread;
    const targetX = x > 0 ? x + travel * .1 : x - travel * .1;
    const targetY = y > 0 ? y + travel * .1 : y - travel * .1;
    item.position.set(THREE.MathUtils.lerp(item.position.x, targetX, .05), THREE.MathUtils.lerp(item.position.y, targetY, .05), position[2]);
    item.getWorldPosition(world);
    const opacity = THREE.MathUtils.clamp(Math.abs(world.z - camera.position.z) / 10, 0, 1);
    if (item.material instanceof THREE.Material) item.material.setValues({ opacity });
  });
}

interface MediaPlaneProps extends SceneProps { media: SceneMedia; position: [number, number, number]; multiplier: number; pointer: MutableRefObject<PointerState> }

function ImagePlane({ media, position, multiplier, motion, pointer }: MediaPlaneProps) {
  const texture = useTexture(media.url);
  const managedTexture = useRef(texture);
  const mesh = useRef<THREE.Mesh>(null);
  const scale = useCover(media.width, media.height, multiplier);
  useMediaMotion(mesh, motion, position, pointer);
  useEffect(() => { managedTexture.current.colorSpace = THREE.SRGBColorSpace; }, []);
  return <mesh ref={mesh} position={position} scale={scale}>
    <planeGeometry args={[1, 1]} /><meshBasicMaterial map={texture} transparent toneMapped={false} />
  </mesh>;
}

function VideoPlane({ media, position, multiplier, motion, pointer }: MediaPlaneProps) {
  const url = media.video?.mp4Url ?? media.url;
  const texture = useVideoTexture(url, { muted: true, loop: true, start: true, playsInline: true, crossOrigin: "anonymous" });
  const managedTexture = useRef(texture);
  const mesh = useRef<THREE.Mesh>(null);
  const scale = useCover(media.width, media.height, multiplier);
  useMediaMotion(mesh, motion, position, pointer);
  useEffect(() => {
    managedTexture.current.colorSpace = THREE.SRGBColorSpace;
    managedTexture.current.minFilter = THREE.LinearFilter;
    managedTexture.current.magFilter = THREE.LinearFilter;
    const play = () => { void texture.image.play().catch(() => {}); };
    window.addEventListener("pointerdown", play, { passive: true });
    return () => { window.removeEventListener("pointerdown", play); texture.image.pause(); };
  }, [texture]);
  return <mesh ref={mesh} position={position} scale={scale}>
    <planeGeometry args={[1, 1]} /><meshBasicMaterial map={texture} transparent toneMapped={false} />
  </mesh>;
}

function Rock({ motion, footer = false, pointer }: SceneProps & { footer?: boolean; pointer: MutableRefObject<PointerState> }) {
  const gltf = useGLTF("/models/rockPodium-lite.glb", "/draco/");
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const spin = useRef(0);
  const previousDelta = useRef(0);
  const object = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) child.material = child.material.map((material: THREE.Material) => material.clone());
        else child.material = child.material.clone();
        const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.transparent = true;
      }
    });
    return clone;
  }, [gltf.scene]);
  useEffect(() => () => object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  }), [object]);
  useFrame(({ viewport, size, clock }) => {
    if (!group.current || !light.current) return;
    if (footer) {
      const progress = motion.current.footer;
      group.current.scale.setScalar(1.15 * Math.min(Math.min(1, viewport.aspect), Math.min(1, viewport.height / 5.5)));
      group.current.position.set(0, .3, 0);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -THREE.MathUtils.clamp(progress, 0, 1) * Math.PI * 1.15, .26);
      group.current.rotation.z = Math.PI;
      spin.current += -(pointer.current.delta - previousDelta.current) / Math.max(1, size.width) * Math.PI * .6;
      previousDelta.current = pointer.current.delta;
      group.current.rotation.y += spin.current;
      spin.current *= pointer.current.down ? .9 : .965;
      if (Math.abs(spin.current) < .00001) spin.current = 0;
      const time = clock.elapsedTime * 1.07;
      light.current.position.set((Math.cos(time) + .3 * Math.sin(2.37 * time)) * 1.05, (Math.sin(.73 * time) + .25 * Math.cos(1.93 * time)) * 1.05, 1.94 + .4 * Math.sin(.51 * time));
      return;
    }
    const travel = motion.current.mosaic * 70;
    const normalized = travel / 65;
    group.current.position.set(-1, THREE.MathUtils.lerp(7, 8 - 8 * normalized, .8), -53);
    group.current.rotation.set(THREE.MathUtils.lerp(group.current.rotation.x, -normalized * Math.PI * 2 - Math.PI / 6 - 4.3, .4), 0, 3);
    const time = clock.elapsedTime * .77;
    light.current.position.set(-1 + Math.cos(time) * 1.2, 2 + Math.sin(time) * 1.2, -49 + Math.sin(time) * 1.2);
  });
  let scale = 4;
  let ambient = 1;
  let intensity = 10;
  let decay = .5;
  if (footer) { scale = 1.15; ambient = 1.05; intensity = 7; decay = .6; }
  return <>
    <group ref={group} scale={scale}><primitive object={object} /></group>
    <ambientLight intensity={ambient} />
    <pointLight ref={light} color="white" intensity={intensity} decay={decay} />
  </>;
}

function MosaicTunnel({ motion, pointer }: SceneProps & { pointer: MutableRefObject<PointerState> }) {
  const group = useRef<THREE.Group>(null);
  const fog = useRef<THREE.Fog>(null);
  useFrame(() => {
    const travel = motion.current.mosaic * 70;
    if (group.current) group.current.position.z = travel;
    if (fog.current) { fog.current.near = 5 + travel; fog.current.far = 85 + travel; }
  });
  return <>
    <color attach="background" args={["black"]} />
    <fog ref={fog} attach="fog" args={["black", 5, 85]} />
    <group ref={group}>
      {IMAGES.map((media, index) => <ImagePlane key={`image-${media.url}`} motion={motion} media={media} position={IMAGE_POSITIONS[index]} multiplier={IMAGE_SCALES[index]} pointer={pointer} />)}
      {VIDEOS.map((media, index) => <VideoPlane key={`video-${index}`} motion={motion} media={media} position={VIDEO_POSITIONS[index]} multiplier={VIDEO_SCALES[index]} pointer={pointer} />)}
      <Rock motion={motion} pointer={pointer} />
    </group>
  </>;
}

function Mosaic({ motion, pointer }: SceneProps & { pointer: MutableRefObject<PointerState> }) {
  const { size } = useThree();
  const scale = useCover(size.width, size.height);
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const previous = useRef(0);
  const started = useRef<number | null>(null);
  const [restored] = useState(() => homeSession.loaded);
  const uniforms = useMemo(() => ({ uTexture: { value: null as THREE.Texture | null }, uScrollVelocity: { value: 0 }, uScroll: { value: 1 }, uBarrelMultiplier: { value: 100 }, uPointerOffset: { value: new THREE.Vector2() }, uIsMobile: { value: false } }), []);
  useFrame(({ clock }) => {
    if (!material.current) return;
    const live = material.current.uniforms as typeof uniforms;
    const progress = motion.current.mosaic;
    if (started.current === null) started.current = clock.elapsedTime;
    const revealTime = THREE.MathUtils.clamp((clock.elapsedTime - started.current) / .9, 0, 1);
    let reveal = 1 - Math.pow(-2 * revealTime + 2, 3) / 2;
    if (revealTime < .5) reveal = 4 * Math.pow(revealTime, 3);
    if (restored || homeSession.loaded) reveal = 1;
    live.uScrollVelocity.value = THREE.MathUtils.lerp(live.uScrollVelocity.value, progress - previous.current, .2);
    previous.current = progress;
    live.uScroll.value = THREE.MathUtils.clamp((1 - progress) / .5, 0, 1) * THREE.MathUtils.clamp((reveal - .9) / .1, 0, 1);
    live.uIsMobile.value = pointer.current.coarse;
    live.uBarrelMultiplier.value = pointer.current.coarse ? 25 : 100;
    let strength = 1 - THREE.MathUtils.smoothstep(progress, 0, .04);
    if (pointer.current.coarse) strength = 0;
    live.uPointerOffset.value.x = THREE.MathUtils.lerp(live.uPointerOffset.value.x, (pointer.current.x * 2 - 1) * .0025 * strength, .055);
    live.uPointerOffset.value.y = THREE.MathUtils.lerp(live.uPointerOffset.value.y, (pointer.current.y * 2 - 1) * .0018 * strength, .055);
    if (mesh.current) mesh.current.visible = motion.current.footer <= 0 && progress < 1;
  });
  return <mesh ref={mesh} scale={scale} renderOrder={0}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={fullscreenVertex} fragmentShader={mosaicFragment} transparent depthWrite={false}>
      <RenderTexture attach="uniforms-uTexture-value" stencilBuffer={false}><MosaicTunnel motion={motion} pointer={pointer} /></RenderTexture>
    </shaderMaterial>
  </mesh>;
}

function Footer({ motion, pointer }: SceneProps & { pointer: MutableRefObject<PointerState> }) {
  const { size } = useThree();
  const scale = useCover(size.width, size.height);
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mesh.current || !material.current) return;
    mesh.current.visible = motion.current.footer > 0;
    material.current.opacity = THREE.MathUtils.lerp(material.current.opacity, THREE.MathUtils.clamp(motion.current.footer * 3, 0, 1), .1);
  });
  return <mesh ref={mesh} scale={scale} renderOrder={2} visible={false}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial ref={material} transparent toneMapped={false} opacity={0} depthWrite={false}>
      <RenderTexture attach="map" stencilBuffer={false}>
        <color attach="background" args={["black"]} />
        <Suspense fallback={null}><Rock motion={motion} pointer={pointer} footer /></Suspense>
      </RenderTexture>
    </meshBasicMaterial>
  </mesh>;
}

function SceneReady() {
  const frames = useRef(0);
  const emitted = useRef(false);
  useFrame(() => {
    if (emitted.current) return;
    frames.current += 1;
    if (frames.current < 3) return;
    emitted.current = true;
    document.getElementById("global-canvas")?.setAttribute("data-scene-loaded", "true");
    window.dispatchEvent(new Event("podium:scene-ready"));
  });
  return null;
}

export default function PodiumScene({ motion }: SceneProps) {
  const pointer = usePointer(motion);
  return <div id="global-canvas" aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100lvh", zIndex: 0, pointerEvents: "none" }}>
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]} gl={{ antialias: false, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}>
      <Suspense fallback={null}><Mosaic motion={motion} pointer={pointer} /><HeroShape motion={motion} pointer={pointer} /><Footer motion={motion} pointer={pointer} /><SceneReady /></Suspense>
      <Suspense fallback={null}><WorldwideScene motion={motion} pointer={pointer} /></Suspense>
    </Canvas>
  </div>;
}
