/**
 * 3D octahedron renderer for the CubeTac "Octahedron" variant.
 *
 * Draws all 8 triangular faces with their 9 cells (6 perimeter up-triangles
 * + 3 dead down-triangles). Up-triangles are clickable stickers the current
 * player can mark; down-triangles are rendered as visually distinct grout
 * pieces — non-interactive. Rotations are triggered by the parent
 * `RotateControls` panel, not by clicking the face itself (no fixed-point
 * cell exists on a 9-piece triangular face under 120° rotation, so the
 * megaminx "center button" pattern doesn't apply here).
 *
 * Rotation animation: the parent's `playMove(face, dir)` ref kicks off a
 * short visual spin of the affected cells, then the new marks prop snaps in.
 */

import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
    forwardRef,
    memo,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    CELLS_PER_FACE,
    Direction,
    FACES,
    Marks,
    Vec3,
    cellCentroid,
    cellPolygon,
    faceCenters,
    faceNormals,
    faceVertices,
    firstRingCells,
    indexOf,
    isPlayable,
    moveKey,
    moveParams,
    vertices,
} from '@/lib/octahedron';
import MarkGlyph, { GLYPH_REFERENCE_HALF_WIDTH } from './MarkGlyph';

/** A pleasantly distinct color per face — 8 pastels, one per octahedron face. */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200 (yellow)
    '#fca5a5', // red-300
    '#cbd5e1', // slate-300 (gray)
    '#bbf7d0', // green-200
    '#bfdbfe', // blue-200
    '#fed7aa', // orange-200
    '#a5f3fc', // cyan-200
    '#fbcfe8', // pink-200
];

const FALLBACK_GLYPH_COLOR = '#94a3b8';
const ANIMATION_MS = 240;

export type OctaCellClickHandler = (face: number, slot: number) => void;
export type OctaRotateHandler = (face: number, direction: Direction) => void;

export interface OctahedronSceneHandle {
    /** Animate a face rotation locally; the new marks come back via the next prop update. */
    playMove: (face: number, direction: Direction) => Promise<void>;
}

interface OctahedronSceneProps {
    marks: Marks;
    /** Hex colors indexed by slot. */
    playerColors: string[];
    /** Glyph-design indices (0..5) indexed by slot. */
    designs?: number[];
    /** Winning cells to highlight (flat indices). */
    winningIndices?: Set<number>;
    /** Pending mark (cell the current player can tap again to undo). */
    pendingIndex?: number | null;
    onCellClick?: OctaCellClickHandler;
    /** Required to call `playMove`; the parent panel that owns the rotate
     *  buttons should pass this down so this scene also receives rotation
     *  intents (e.g. from network round-trips). Currently unused at the
     *  scene level — kept for symmetry with `MegaminxScene`. */
    onRotate?: OctaRotateHandler;
    /** True when the current viewer can act this turn. */
    interactive: boolean;
}

interface PendingAnimation {
    face: number;
    direction: Direction;
    startTime: number;
    resolve: () => void;
}

/**
 * The exact 18 cell flat-indices that visually move when face F rotates:
 * F's own 9 (rotate as one disc), plus 3 cells × 3 adjacent faces = 9 first-
 * ring cells on neighbors. Matches `OctahedronCube::buildFacePermutation` in PHP.
 */
function affectedCells(face: number): number[] {
    const out: number[] = [];
    for (let s = 0; s < CELLS_PER_FACE; s++) {
        out.push(indexOf(face, s));
    }
    out.push(...firstRingCells(face));
    return out;
}

const OctahedronScene = forwardRef<OctahedronSceneHandle, OctahedronSceneProps>(function OctahedronScene(
    { marks, playerColors, designs, winningIndices, pendingIndex = null, onCellClick, onRotate, interactive },
    ref,
) {
    const animationRef = useRef<PendingAnimation | null>(null);
    const [animationTick, setAnimationTick] = useState(0);
    const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
    const heldArrowKeysRef = useRef<Set<string>>(new Set());

    // Hold-to-orbit: tracking arrow keys in a Set + applying per frame in
    // <ArrowKeyOrbit> mirrors mouse drag cadence and avoids the OS key-repeat
    // delay (~500 ms before the second event fires). Same pattern as CubeScene.
    useEffect(() => {
        const isArrow = (key: string) =>
            key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

        const onKeyDown = (e: KeyboardEvent) => {
            if (!isArrow(e.key)) return;
            const target = e.target as HTMLElement | null;
            if (
                target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.isContentEditable
            ) {
                return;
            }
            e.preventDefault();
            heldArrowKeysRef.current.add(e.key);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (!isArrow(e.key)) return;
            heldArrowKeysRef.current.delete(e.key);
        };
        const onBlur = () => {
            heldArrowKeysRef.current.clear();
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            playMove(face, direction) {
                return new Promise<void>((resolve) => {
                    animationRef.current = {
                        face,
                        direction,
                        startTime: performance.now(),
                        resolve,
                    };
                    setAnimationTick((t) => t + 1);
                });
            },
        }),
        [],
    );

    return (
        <Canvas
            camera={{ position: [2.4, 2.0, 2.6], fov: 45 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
        >
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 7, 4]} intensity={0.6} />
            <directionalLight position={[-4, -3, -5]} intensity={0.25} />

            <OrbitControls
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={orbitControlsRef as any}
                makeDefault
                enablePan={false}
                enableZoom={true}
                minDistance={2.2}
                maxDistance={6}
                rotateSpeed={0.7}
                zoomSpeed={0.6}
            />
            <ArrowKeyOrbit controlsRef={orbitControlsRef} heldKeysRef={heldArrowKeysRef} />

            <OctahedronGroup
                marks={marks}
                playerColors={playerColors}
                designs={designs}
                winningIndices={winningIndices}
                pendingIndex={pendingIndex}
                onCellClick={onCellClick}
                onRotate={onRotate}
                interactive={interactive}
                animationRef={animationRef}
                tick={animationTick}
                onAnimationComplete={() => {
                    animationRef.current?.resolve();
                    animationRef.current = null;
                    setAnimationTick((t) => t + 1);
                }}
            />
        </Canvas>
    );
});

export default OctahedronScene;

// ---------------------------------------------------------------------------
// Arrow-key camera orbit — held arrow keys spin the octahedron in space.
// ---------------------------------------------------------------------------

const ORBIT_SPEED_RAD_PER_SEC = Math.PI * 6;

interface OrbitControlsImpl {
    getAzimuthalAngle: () => number;
    getPolarAngle: () => number;
    setAzimuthalAngle: (angle: number) => void;
    setPolarAngle: (angle: number) => void;
}

function ArrowKeyOrbit({
    controlsRef,
    heldKeysRef,
}: {
    controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
    heldKeysRef: React.MutableRefObject<Set<string>>;
}) {
    useFrame((_, delta) => {
        const held = heldKeysRef.current;
        if (held.size === 0) return;
        const controls = controlsRef.current;
        if (!controls) return;
        const step = ORBIT_SPEED_RAD_PER_SEC * delta;
        let dx = 0;
        let dy = 0;
        if (held.has('ArrowLeft')) dx -= step;
        if (held.has('ArrowRight')) dx += step;
        if (held.has('ArrowUp')) dy -= step;
        if (held.has('ArrowDown')) dy += step;
        if (dx !== 0) {
            controls.setAzimuthalAngle(controls.getAzimuthalAngle() - dx);
        }
        if (dy !== 0) {
            controls.setPolarAngle(controls.getPolarAngle() - dy);
        }
    });
    return null;
}

// ---------------------------------------------------------------------------

interface OctahedronGroupProps extends Omit<OctahedronSceneProps, 'marks'> {
    marks: Marks;
    animationRef: React.MutableRefObject<PendingAnimation | null>;
    tick: number;
    onAnimationComplete: () => void;
}

const OctahedronGroup = memo(function OctahedronGroup({
    marks,
    playerColors,
    designs,
    winningIndices,
    pendingIndex,
    onCellClick,
    interactive,
    animationRef,
    onAnimationComplete,
}: OctahedronGroupProps) {
    const rotatingGroupRef = useRef<THREE.Group>(null);

    const facePolys = useMemo(() => {
        const verts = vertices();
        const fv = faceVertices();
        return fv.map((vIndices) => vIndices.map((i) => verts[i] as Vec3));
    }, []);
    const centers = useMemo(() => faceCenters(), []);
    const normals = useMemo(() => faceNormals(), []);

    const affected = useMemo(() => {
        const a = animationRef.current;
        if (!a) return new Set<number>();
        return new Set(affectedCells(a.face));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animationRef.current]);

    useFrame(() => {
        const anim = animationRef.current;
        const grp = rotatingGroupRef.current;
        if (!anim || !grp) {
            if (grp) grp.rotation.set(0, 0, 0);
            return;
        }
        const elapsed = performance.now() - anim.startTime;
        const t = Math.min(1, elapsed / ANIMATION_MS);
        const params = moveParams()[moveKey(anim.face, anim.direction)];
        const axis = new THREE.Vector3(params.axis[0], params.axis[1], params.axis[2]);
        const angle = params.angle * t;
        grp.setRotationFromAxisAngle(axis, angle);

        if (t >= 1) {
            grp.rotation.set(0, 0, 0);
            onAnimationComplete();
        }
    });

    const animatingFace = animationRef.current?.face ?? null;

    return (
        <>
            <group>
                {Array.from({ length: FACES }, (_, f) => (
                    <FaceMesh
                        key={`face-${f}`}
                        face={f}
                        polygon={facePolys[f]}
                        center={centers[f]}
                        normal={normals[f]}
                        marks={marks}
                        playerColors={playerColors}
                        designs={designs}
                        winningIndices={winningIndices}
                        pendingIndex={pendingIndex}
                        onCellClick={onCellClick}
                        interactive={interactive}
                        excludeIndices={affected}
                        renderBackdrop={animatingFace === null || f !== animatingFace}
                    />
                ))}
            </group>

            {affected.size > 0 && (
                <group ref={rotatingGroupRef}>
                    {Array.from({ length: FACES }, (_, f) => (
                        <FaceMesh
                            key={`face-rot-${f}`}
                            face={f}
                            polygon={facePolys[f]}
                            center={centers[f]}
                            normal={normals[f]}
                            marks={marks}
                            playerColors={playerColors}
                            designs={designs}
                            winningIndices={winningIndices}
                            pendingIndex={pendingIndex}
                            interactive={false}
                            includeOnlyIndices={affected}
                            renderBackdrop={f === animatingFace}
                        />
                    ))}
                </group>
            )}
        </>
    );
});

// ---------------------------------------------------------------------------

interface FaceMeshProps {
    face: number;
    polygon: Vec3[];
    center: Vec3;
    normal: Vec3;
    marks: Marks;
    playerColors: string[];
    designs?: number[];
    winningIndices?: Set<number>;
    pendingIndex?: number | null;
    onCellClick?: OctaCellClickHandler;
    interactive: boolean;
    includeOnlyIndices?: Set<number>;
    excludeIndices?: Set<number>;
    renderBackdrop?: boolean;
}

function FaceMesh({
    face,
    polygon,
    center,
    normal,
    marks,
    playerColors,
    designs,
    winningIndices,
    pendingIndex,
    onCellClick,
    interactive,
    includeOnlyIndices,
    excludeIndices,
    renderBackdrop = true,
}: FaceMeshProps) {
    // Black "grout" triangle behind the 9 small pieces — shows through the
    // inset gaps so the puzzle surface looks like a real Octahedron with
    // visible gaps between stickers.
    const backdropGeometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            positions.push(center[0], center[1], center[2]);
            positions.push(a[0], a[1], a[2]);
            positions.push(b[0], b[1], b[2]);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        return geo;
    }, [polygon, center]);

    const faceColor = FACE_COLORS[face % FACE_COLORS.length];

    return (
        <group>
            {renderBackdrop && (
                <mesh geometry={backdropGeometry}>
                    <meshStandardMaterial color="#0f172a" side={THREE.DoubleSide} roughness={0.85} />
                </mesh>
            )}

            {Array.from({ length: CELLS_PER_FACE }, (_, slot) => {
                const flat = indexOf(face, slot);
                if (includeOnlyIndices && !includeOnlyIndices.has(flat)) return null;
                if (excludeIndices?.has(flat)) return null;

                const playable = isPlayable(slot);
                const mark = playable ? marks[flat] ?? null : null;
                const isWin = winningIndices?.has(flat) ?? false;
                const isPending = pendingIndex === flat;
                const designIdx = mark !== null ? designs?.[mark] ?? mark : null;

                // Up-triangles get the face color when empty; the player's
                // avatar color when marked. Down-triangles show a clearly
                // distinct dim slate so they read as "dead" but stay
                // visible against the near-black backdrop grout.
                const baseColor = !playable
                    ? '#64748b'
                    : mark !== null
                        ? playerColors[mark] ?? FALLBACK_GLYPH_COLOR
                        : faceColor;

                return (
                    <PieceTile
                        key={`piece-${face}-${slot}`}
                        face={face}
                        slot={slot}
                        normal={normal}
                        color={baseColor}
                        design={designIdx}
                        fillColor="#0f172a"
                        glowColor={mark !== null ? (playerColors[mark] ?? FALLBACK_GLYPH_COLOR) : '#ffffff'}
                        isWin={isWin}
                        isPending={isPending}
                        isMarked={mark !== null}
                        clickable={playable && interactive && (mark === null || isPending)}
                        onClick={() => onCellClick?.(face, slot)}
                    />
                );
            })}
        </group>
    );
}

// ---------------------------------------------------------------------------

interface PieceTileProps {
    face: number;
    slot: number;
    normal: Vec3;
    color: string;
    design: number | null;
    fillColor: string;
    glowColor: string;
    isWin: boolean;
    isPending: boolean;
    isMarked: boolean;
    clickable: boolean;
    onClick: () => void;
}

function PieceTile({
    face,
    slot,
    normal,
    color,
    design,
    fillColor,
    glowColor,
    isWin,
    isPending,
    isMarked,
    clickable,
    onClick,
}: PieceTileProps) {
    const polygon = useMemo(() => cellPolygon(face, slot), [face, slot]);
    const centroid = useMemo(() => cellCentroid(face, slot), [face, slot]);

    const geometry = useMemo(() => {
        const lift = 0.014;
        const lifted = polygon.map((v) => liftAlongNormal(v, normal, lift));
        const centroidLifted = liftAlongNormal(centroid, normal, lift);
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (let i = 0; i < lifted.length; i++) {
            const a = lifted[i];
            const b = lifted[(i + 1) % lifted.length];
            positions.push(centroidLifted[0], centroidLifted[1], centroidLifted[2]);
            positions.push(a[0], a[1], a[2]);
            positions.push(b[0], b[1], b[2]);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        return geo;
    }, [polygon, centroid, normal[0], normal[1], normal[2]]);

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (clickable) onClick();
    };

    const glyphQuaternion = useMemo(() => {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
        return q;
    }, [normal[0], normal[1], normal[2]]);
    const glyphPosition = useMemo(() => liftAlongNormal(centroid, normal, 0.022), [centroid, normal[0], normal[1], normal[2]]);

    const glyphSize = useMemo(() => {
        let minDistSq = Infinity;
        for (const v of polygon) {
            const dx = v[0] - centroid[0];
            const dy = v[1] - centroid[1];
            const dz = v[2] - centroid[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < minDistSq) minDistSq = d2;
        }
        return Math.sqrt(minDistSq) * 1.05;
    }, [polygon, centroid]);

    return (
        <group>
            <mesh geometry={geometry} onPointerDown={handleClick}>
                <meshStandardMaterial
                    color={color}
                    side={THREE.DoubleSide}
                    transparent={isPending}
                    opacity={isPending ? 0.7 : 1}
                    roughness={0.42}
                    metalness={0.04}
                    emissive={isWin ? color : '#000000'}
                    emissiveIntensity={isWin ? 0.55 : 0}
                />
            </mesh>
            {design !== null && isMarked && (
                <group
                    position={glyphPosition}
                    quaternion={glyphQuaternion}
                    scale={[
                        glyphSize / GLYPH_REFERENCE_HALF_WIDTH,
                        glyphSize / GLYPH_REFERENCE_HALF_WIDTH,
                        1,
                    ]}
                >
                    <MarkGlyph
                        design={design}
                        color={fillColor}
                        glowColor={glowColor}
                        opacity={isPending ? 0.65 : 1}
                    />
                </group>
            )}
        </group>
    );
}

// ---------------------------------------------------------------------------

function liftAlongNormal(pos: Vec3, normal: Vec3, amount: number): Vec3 {
    return [pos[0] + normal[0] * amount, pos[1] + normal[1] * amount, pos[2] + normal[2] * amount];
}
