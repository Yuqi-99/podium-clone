"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import { SVGLoader, type SVGResult } from "three/examples/jsm/loaders/SVGLoader.js";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import * as THREE from "three";
import type { SceneMotion } from "@/types/scene";

interface WorldPointer { x: number; y: number }
interface WorldProps { motion: MutableRefObject<SceneMotion>; pointer: MutableRefObject<WorldPointer> }
type PointTuple = [number, number, number];
interface PathLinesProps extends WorldProps {
  url: string; desiredSize: number; divisions: number; color?: string;
  flipY?: boolean; silhouette?: boolean; opacity?: number;
  direction?: "vertical" | "horizontal"; lerp?: number;
  position?: PointTuple; rotation?: PointTuple; scale?: number;
}

const ORIGIN: PointTuple = [0, 0, 0];

const SQUARES = [
  { x: 4, y: 3, parallax: 2.5 }, { x: 3.5, y: 1, parallax: 1.2 },
  { x: 5, y: -1, parallax: -1.8 }, { x: 4, y: -2, parallax: 3 },
  { x: -2.5, y: -1, parallax: -1.4 }, { x: -3.5, y: -2.5, parallax: 2.8 },
  { x: -6.5, y: 0, parallax: -2 },
];
const VERTICAL_LINES = [
  { x: -5.5, lerp: .6 }, { x: -3, lerp: .2 },
  { x: 5.5, lerp: .3 }, { x: 3, lerp: .2 },
  { x: -1.5, lerp: .1 }, { x: 1.5, lerp: .1 },
];

function samplePaths(svg: SVGResult, desiredSize: number, divisions: number, flipY: boolean): PointTuple[][] {
  const source = svg.paths.flatMap((path) => path.subPaths.map((subPath) => subPath.getPoints(divisions)));
  const all = source.flatMap((path) => path.map((point) => new THREE.Vector3(point.x, point.y, 0)));
  const box = new THREE.Box3().setFromPoints(all);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const factor = desiredSize / Math.max(size.x, size.y);
  return source.filter((path) => path.length >= 2).map((path) => path.map((point): PointTuple => {
    const vector = new THREE.Vector3(point.x, point.y, 0).sub(center).multiplyScalar(factor);
    if (flipY) vector.y *= -1;
    return [vector.x, vector.y, 0];
  })).sort((left, right) => {
    const leftBox = new THREE.Box3().setFromPoints(left.map((point) => new THREE.Vector3(...point)));
    const rightBox = new THREE.Box3().setFromPoints(right.map((point) => new THREE.Vector3(...point)));
    return leftBox.getSize(new THREE.Vector3()).x - rightBox.getSize(new THREE.Vector3()).x;
  });
}

function TrackArrow({ points, motion, index }: { points: PointTuple[]; motion: MutableRefObject<SceneMotion>; index: number }) {
  const desktop = useThree((state) => state.size.width >= 768);
  const texture = useTexture(desktop ? "/images/arrow.png" : "/images/arrow-white.png");
  const mesh = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), true, "centripetal"), [points]);
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
    result.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, .5, 0, .5, 1, 1, 0, 1, 1]), 2));
    result.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
    return result;
  }, []);
  const vectors = useMemo(() => ({ point: new THREE.Vector3(), tangent: new THREE.Vector3(), offset: new THREE.Vector3(), left: new THREE.Vector3(), right: new THREE.Vector3() }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const elapsed = clock.elapsedTime + index * 1.73;
    const cycle = elapsed % 5.3;
    let alpha = 1;
    if (cycle < .8) alpha = cycle / .8;
    if (cycle > 4.9) alpha = (5.3 - cycle) / .4;
    mesh.current.material.opacity = alpha * THREE.MathUtils.clamp(motion.current.worldwide / .6, 0, 1);
    const progress = (.008 * elapsed + index * .137) % 1;
    const positions = mesh.current.geometry.attributes.position;
    for (let segment = 0; segment <= 2; segment += 1) {
      const time = (progress + segment / 2 * .004) % 1;
      curve.getPointAt(time, vectors.point);
      curve.getTangentAt(time, vectors.tangent);
      vectors.offset.set(-vectors.tangent.y, vectors.tangent.x, 0).normalize().multiplyScalar(.02);
      vectors.left.copy(vectors.point).add(vectors.offset);
      vectors.right.copy(vectors.point).sub(vectors.offset);
      positions.setXYZ(segment * 2, vectors.left.x, vectors.left.y, vectors.left.z);
      positions.setXYZ(segment * 2 + 1, vectors.right.x, vectors.right.y, vectors.right.z);
    }
    positions.needsUpdate = true;
  });
  return <mesh ref={mesh} geometry={geometry} position={[0, 0, .01]} renderOrder={1} frustumCulled={false}>
    <meshBasicMaterial map={texture} color="#a6a6a6" transparent toneMapped={false} fog={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}

function DashedPath({ points, motion, opacity, color }: { points: PointTuple[]; motion: MutableRefObject<SceneMotion>; opacity: number; color: string }) {
  const line = useRef<Line2 | LineSegments2>(null);
  useFrame(() => {
    if (line.current) line.current.material.opacity = opacity * THREE.MathUtils.clamp(motion.current.worldwide / .6, 0, 1);
  });
  return <Line ref={line} points={points} color={color} lineWidth={1.5} dashed dashSize={.04} gapSize={.03} transparent toneMapped={false} depthTest={false} depthWrite={false} renderOrder={1} />;
}

function PathLines({ motion, pointer, url, desiredSize, divisions, color = "#000000", flipY = true, silhouette = false, opacity = 1, direction, lerp = .5, position = ORIGIN, rotation = ORIGIN, scale = 1 }: PathLinesProps) {
  const svg = useLoader(SVGLoader, url);
  const paths = useMemo(() => samplePaths(svg, desiredSize, divisions, flipY), [svg, desiredSize, divisions, flipY]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const desktop = useThree((state) => state.size.width >= 768);
  useFrame(() => {
    if (!desktop) return;
    for (let index = 0; index < paths.length; index += 1) {
      const group = groups.current[index];
      if (!group) continue;
      const divisor = 1 + index / 4;
      const x = (pointer.current.x * 2 - 1) / divisor * .1;
      const y = (pointer.current.y * 2 - 1) / divisor * .1;
      const remaining = paths.length - index;
      let factor = lerp;
      if (silhouette) factor = .1;
      if (direction === "horizontal") group.position.y = y + THREE.MathUtils.lerp(group.position.y, y * remaining * .4 + position[1], factor);
      else group.position.x = x + THREE.MathUtils.lerp(group.position.x, -x * remaining * .4 + position[0], factor);
    }
  });
  return <group>
    {paths.map((points, index) => {
      let pathScale = scale;
      let z = position[2];
      if (silhouette) { pathScale = 1 + index * Math.pow(.08 / paths.length, .7); z = -index * .08; }
      return <group key={index} ref={(group) => { groups.current[index] = group; }} scale={pathScale} position={[position[0], position[1], z]} rotation={rotation}>
        <DashedPath points={points} motion={motion} opacity={opacity} color={color} />
        {silhouette ? <Suspense fallback={null}><TrackArrow points={points} motion={motion} index={index * 2} /><TrackArrow points={points} motion={motion} index={index * 2 + 1} /></Suspense> : null}
      </group>;
    })}
  </group>;
}

function Square({ motion, pointer, x, y, parallax }: WorldProps & { x: number; y: number; parallax: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, (motion.current.worldwide - .5) * parallax, .15);
  });
  return <group ref={group}>
    <PathLines motion={motion} pointer={pointer} url="/images/square.svg" desiredSize={5} divisions={12} flipY={false} lerp={.3} position={[x, y, 0]} scale={1 / 40} />
  </group>;
}

export default function WorldwideScene({ motion, pointer }: WorldProps) {
  const group = useRef<THREE.Group>(null);
  const shape = useRef<THREE.Group>(null);
  const circle = useRef<THREE.Group>(null);
  const background = useRef<THREE.MeshBasicMaterial>(null);
  const { viewport, size } = useThree();
  const desktop = size.width >= 768;
  const sectionVh = useRef(4);
  const mobileDevice = useRef(false);
  useEffect(() => {
    mobileDevice.current = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const section = document.querySelector("#about");
    if (!section) return;
    const measure = () => { sectionVh.current = section.getBoundingClientRect().height / window.innerHeight; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    window.addEventListener("resize", measure, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useFrame(() => {
    const progress = motion.current.worldwide;
    if (group.current) group.current.visible = progress > 0;
    const worldHeight = sectionVh.current * viewport.height;
    const scale = worldHeight * .1;
    const y = (THREE.MathUtils.clamp(progress, 0, 1) - .5) * (worldHeight + viewport.height) + .15 * worldHeight;
    for (const target of [shape.current, circle.current]) {
      if (!target) continue;
      target.scale.setScalar(scale);
      if (mobileDevice.current) target.position.y = THREE.MathUtils.lerp(target.position.y, y, .15);
      else target.position.y = y;
    }
    if (background.current) background.current.opacity = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(progress / .6, 0, 1), 0, .3);
  });
  return <group ref={group} visible={false}>
    <mesh position={[0, 0, -.01]} scale={[viewport.width, viewport.height, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} /><meshBasicMaterial ref={background} color="white" transparent opacity={0} toneMapped={false} depthWrite={false} depthTest={false} />
    </mesh>
    <group ref={circle}><PathLines motion={motion} pointer={pointer} url="/images/circle.svg" desiredSize={9.45} divisions={36} /></group>
    {desktop ? <group position={[.1, 0, -1.2]} scale={1.2}>{SQUARES.map((square, index) => <Square key={index} {...square} motion={motion} pointer={pointer} />)}</group> : null}
    <group position={[0, 0, -1.5]} scale={1.3}>
      {VERTICAL_LINES.map((line, index) => {
        if (!desktop && index < 4) return null;
        return <PathLines key={line.x} motion={motion} pointer={pointer} url="/images/line.svg" desiredSize={7} divisions={1} direction="vertical" lerp={line.lerp} opacity={desktop ? 1 : .5} position={[line.x, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={2} />;
      })}
    </group>
    <group position={[0, desktop ? 0 : .5, -1]} scale={1.14}>
      <PathLines motion={motion} pointer={pointer} url="/images/line.svg" desiredSize={7} divisions={1} direction="horizontal" position={[0, 3.71, 0]} scale={3} lerp={.1} />
      {desktop ? <><PathLines motion={motion} pointer={pointer} url="/images/line.svg" desiredSize={7} divisions={1} direction="horizontal" position={[0, 2, 0]} scale={3} lerp={.1} /><PathLines motion={motion} pointer={pointer} url="/images/line.svg" desiredSize={7} divisions={1} direction="horizontal" position={[0, -1.5, 0]} scale={3} /></> : null}
    </group>
    <group ref={shape}><PathLines motion={motion} pointer={pointer} url="/images/shapes.svg" desiredSize={7} divisions={6} color="#a6a6a6" silhouette /></group>
  </group>;
}
