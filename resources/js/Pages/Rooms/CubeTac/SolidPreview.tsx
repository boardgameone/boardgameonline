/**
 * Interactive 3D preview of a CubeTac playing-surface solid.
 *
 * Rendered with React Three Fiber (the project's Three.js convention) inside a
 * dark, self-contained panel. Each solid is built from a Three.js
 * BufferGeometry, split into non-indexed triangles, and given per-face colors
 * via a vertex `color` BufferAttribute — triangles are grouped by their face
 * normal so every flat face gets one distinct hue (6 for the cube, 12 for the
 * dodecahedron, and so on).
 *
 * The camera auto-orbits via drei's OrbitControls so all faces come into view,
 * and the user can drag to rotate / scroll to zoom. Escape or the close button
 * dismisses the panel.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Suspense, useEffect, useMemo } from 'react';

export type SolidVariant = 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron';

interface SolidMeta {
    name: string;
    faces: number;
}

/** Display name + face count for each playing-surface solid. */
export const SOLID_META: Record<SolidVariant, SolidMeta> = {
    cube: { name: 'Cube', faces: 6 },
    megaminx: { name: 'Megaminx', faces: 12 },
    pyraminx: { name: 'Pyraminx', faces: 4 },
    octahedron: { name: 'Octahedron', faces: 8 },
    icosahedron: { name: 'Icosahedron', faces: 20 },
};

/**
 * Builds the base BufferGeometry for a solid using the geometry mandated for
 * each variant. Sizes are tuned so every solid frames similarly in the canvas.
 */
function baseGeometry(variant: SolidVariant): THREE.BufferGeometry {
    switch (variant) {
        case 'cube':
            return new THREE.BoxGeometry(2.2, 2.2, 2.2);
        case 'megaminx':
            return new THREE.DodecahedronGeometry(1.5);
        case 'pyraminx':
            return new THREE.TetrahedronGeometry(1.9);
        case 'octahedron':
            return new THREE.OctahedronGeometry(1.7);
        case 'icosahedron':
            return new THREE.IcosahedronGeometry(1.6);
    }
}

/**
 * Returns a non-indexed geometry whose vertices carry a per-face color. Each
 * triangle is assigned to a face group keyed by its (quantized) face normal —
 * coplanar triangles belonging to the same flat face share a normal, so the
 * group count equals the solid's real face count.
 */
function coloredSolidGeometry(variant: SolidVariant): THREE.BufferGeometry {
    const base = baseGeometry(variant);
    const geo = base.index ? base.toNonIndexed() : base;
    if (geo !== base) {
        base.dispose();
    }

    const position = geo.getAttribute('position');
    const triangleCount = position.count / 3;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const faceGroupByKey = new Map<string, number>();
    const triangleFaceGroup: number[] = [];

    for (let t = 0; t < triangleCount; t++) {
        a.fromBufferAttribute(position, t * 3 + 0);
        b.fromBufferAttribute(position, t * 3 + 1);
        c.fromBufferAttribute(position, t * 3 + 2);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        normal.crossVectors(ab, ac).normalize();

        const key = `${Math.round(normal.x * 1000)},${Math.round(normal.y * 1000)},${Math.round(normal.z * 1000)}`;
        let group = faceGroupByKey.get(key);
        if (group === undefined) {
            group = faceGroupByKey.size;
            faceGroupByKey.set(key, group);
        }
        triangleFaceGroup.push(group);
    }

    const faceCount = faceGroupByKey.size;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();

    for (let t = 0; t < triangleCount; t++) {
        color.setHSL(triangleFaceGroup[t] / faceCount, 0.62, 0.55);
        for (let v = 0; v < 3; v++) {
            const offset = (t * 3 + v) * 3;
            colors[offset + 0] = color.r;
            colors[offset + 1] = color.g;
            colors[offset + 2] = color.b;
        }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
}

function ColoredSolid({ variant }: { variant: SolidVariant }) {
    const geometry = useMemo(() => coloredSolidGeometry(variant), [variant]);
    const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 12), [geometry]);

    useEffect(() => {
        return () => {
            geometry.dispose();
            edges.dispose();
        };
    }, [geometry, edges]);

    return (
        <group>
            <mesh geometry={geometry}>
                <meshStandardMaterial vertexColors flatShading roughness={0.5} metalness={0.05} />
            </mesh>
            <lineSegments geometry={edges}>
                <lineBasicMaterial color="#0b1020" transparent opacity={0.55} />
            </lineSegments>
        </group>
    );
}

interface SolidPreviewProps {
    variant: SolidVariant;
    onClose: () => void;
}

export default function SolidPreview({ variant, onClose }: SolidPreviewProps) {
    const meta = SOLID_META[variant];

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="mx-auto mt-3 w-full max-w-md rounded-3xl border border-white/10 bg-gray-950/95 p-4 shadow-2xl ring-1 ring-black/40">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <span className="text-base font-black tracking-wide text-white">{meta.name}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                        {meta.faces} Faces
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close preview"
                    title="Close preview (Esc)"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-gray-300 transition hover:bg-white/15 hover:text-white"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="relative mt-3 h-64 w-full overflow-hidden rounded-2xl bg-linear-to-b from-gray-900 to-gray-950 sm:h-72">
                <Canvas camera={{ position: [3, 2.2, 3.6], fov: 42 }} dpr={[1, 2]}>
                    <ambientLight intensity={0.75} />
                    <directionalLight position={[4, 6, 5]} intensity={1.1} />
                    <directionalLight position={[-5, -3, -4]} intensity={0.35} />
                    <Suspense fallback={null}>
                        <ColoredSolid variant={variant} />
                    </Suspense>
                    <OrbitControls
                        enablePan={false}
                        enableDamping
                        autoRotate
                        autoRotateSpeed={0.9}
                        minDistance={3}
                        maxDistance={9}
                    />
                </Canvas>
                <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                    Drag to rotate · scroll to zoom
                </div>
            </div>
        </div>
    );
}
