/**
 * 3D dodecahedron renderer for the CubeTac "Megaminx" variant.
 *
 * Draws all 12 pentagonal faces with their 11 cells (1 center button + 10
 * perimeter cells). Center is split into two arrow halves: tap the left
 * half to rotate the face CCW, the right half to rotate CW. Every other
 * cell is a clickable sticker that the current player can mark.
 *
 * Rotation animation is intentionally minimal in v1: the parent's
 * `playMove(face, dir)` ref kicks off a short visual spin of the affected
 * cells, then the new marks prop snaps in. The full piece-rotation
 * choreography from CubeScene is a clear follow-up but would balloon this
 * file beyond its first-iteration footprint.
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
    moveKey,
    moveParams,
    vertices,
} from '@/lib/megaminx';
import MarkGlyph, { GLYPH_REFERENCE_HALF_WIDTH } from './MarkGlyph';

/** A pleasantly distinct color per face — used for the pentagon backdrops. */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200 (top, U-ish)
    '#fda4af', // rose-300
    '#a7f3d0', // emerald-200
    '#bae6fd', // sky-200
    '#ddd6fe', // violet-200
    '#fed7aa', // orange-200
    '#bbf7d0', // green-200
    '#fbcfe8', // pink-200
    '#c7d2fe', // indigo-200
    '#fef08a', // yellow-200
    '#a5f3fc', // cyan-200
    '#e9d5ff', // purple-200
];

const FALLBACK_GLYPH_COLOR = '#94a3b8';
const ANIMATION_MS = 220;

export type MegaCellClickHandler = (face: number, slot: number) => void;
export type MegaRotateHandler = (face: number, direction: Direction) => void;

export interface MegaminxSceneHandle {
    /** Animate a face rotation locally; the new marks come back via the next prop update. */
    playMove: (face: number, direction: Direction) => Promise<void>;
}

interface MegaminxSceneProps {
    marks: Marks;
    /** Hex colors indexed by slot. */
    playerColors: string[];
    /** Glyph-design indices (0..5) indexed by slot. */
    designs?: number[];
    /** Winning cells to highlight (flat indices). */
    winningIndices?: Set<number>;
    /** Pending mark (cell the current player can tap again to undo). */
    pendingIndex?: number | null;
    onCellClick?: MegaCellClickHandler;
    onRotate?: MegaRotateHandler;
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
 * The exact 26 cell flat-indices that visually move when face F rotates:
 * F's own 11 (the center stays put on F's axis but is included so the
 * face's disc rotates as one) + 15 first-ring cells on adjacent faces.
 */
function affectedCells(face: number): number[] {
    const out: number[] = [];
    for (let s = 0; s < CELLS_PER_FACE; s++) {
        out.push(indexOf(face, s));
    }
    out.push(...firstRingCells(face));
    return out;
}

const MegaminxScene = forwardRef<MegaminxSceneHandle, MegaminxSceneProps>(function MegaminxScene(
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
            camera={{ position: [0, 0, 6.2], fov: 38 }}
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
                minDistance={4.2}
                maxDistance={9}
                rotateSpeed={0.7}
                zoomSpeed={0.6}
            />
            <ArrowKeyOrbit controlsRef={orbitControlsRef} heldKeysRef={heldArrowKeysRef} />

            <DodecahedronGroup
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

export default MegaminxScene;

// ---------------------------------------------------------------------------
// Arrow-key camera orbit — held arrow keys spin the dodecahedron in space
// (camera orbit, not face turns). Mirrors CubeScene's ArrowKeyOrbit so users
// get the same hold-to-spin feel across both variants.
// ---------------------------------------------------------------------------

const ORBIT_SPEED_RAD_PER_SEC = Math.PI * 6; // ~1080°/sec — matches CubeScene

/**
 * Minimal subset of three-stdlib's OrbitControls we drive directly. Drei
 * exposes the full instance via ref; we only need the spherical-angle
 * getters/setters since `rotateLeft`/`rotateUp` live behind private closures.
 */
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

interface DodecahedronGroupProps extends Omit<MegaminxSceneProps, 'marks'> {
    marks: Marks;
    animationRef: React.MutableRefObject<PendingAnimation | null>;
    tick: number;
    onAnimationComplete: () => void;
}

const DodecahedronGroup = memo(function DodecahedronGroup({
    marks,
    playerColors,
    designs,
    winningIndices,
    pendingIndex,
    onCellClick,
    onRotate,
    interactive,
    animationRef,
    onAnimationComplete,
}: DodecahedronGroupProps) {
    const rotatingGroupRef = useRef<THREE.Group>(null);
    const restGroupRef = useRef<THREE.Group>(null);

    // Static geometry: precompute face vertex positions once.
    const facePolys = useMemo(() => {
        const verts = vertices();
        const fv = faceVertices();
        return fv.map((vIndices) => vIndices.map((i) => verts[i] as Vec3));
    }, []);
    const centers = useMemo(() => faceCenters(), []);
    const normals = useMemo(() => faceNormals(), []);

    // Compute which cells are "affected" by the current animation (if any).
    const affected = useMemo(() => {
        const a = animationRef.current;
        if (!a) return new Set<number>();
        return new Set(affectedCells(a.face));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animationRef.current]);

    // Drive the rotation animation per frame.
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
            <group ref={restGroupRef}>
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
                        onRotate={onRotate}
                        interactive={interactive}
                        excludeIndices={affected}
                        // Hide the rotating face's backdrop during animation;
                        // the rotating group renders that single backdrop instead.
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
                            // No clicks during animation
                            interactive={false}
                            includeOnlyIndices={affected}
                            // Only the rotating face's backdrop spins; adjacent
                            // faces contribute only their 3 first-ring cells.
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
    onCellClick?: MegaCellClickHandler;
    onRotate?: MegaRotateHandler;
    interactive: boolean;
    /** When set, render only cells whose flat-index is in this set. */
    includeOnlyIndices?: Set<number>;
    /** When set, skip cells whose flat-index is in this set. */
    excludeIndices?: Set<number>;
    /** Render the pentagon backdrop. Default true; set false to omit it (used during rotation animation to avoid double-backdrop on non-rotating faces). */
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
    onRotate,
    interactive,
    includeOnlyIndices,
    excludeIndices,
    renderBackdrop = true,
}: FaceMeshProps) {
    // Black "grout" pentagon — sits just below the tiled pieces and shows
    // through the inset gaps between them, matching the look of a real
    // Megaminx puzzle where the piece edges expose the puzzle core.
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

    const includeAll = !includeOnlyIndices;
    const centerSlotFlat = indexOf(face, 0);
    const showCenterButton = includeAll && !excludeIndices?.has(centerSlotFlat);
    const faceColor = FACE_COLORS[face % FACE_COLORS.length];

    return (
        <group>
            {renderBackdrop && (
                <mesh geometry={backdropGeometry}>
                    <meshStandardMaterial color="#0f172a" side={THREE.DoubleSide} roughness={0.85} />
                </mesh>
            )}

            {/* 11 polygonal pieces — center pentagon + 5 corners + 5 edges */}
            {Array.from({ length: CELLS_PER_FACE }, (_, slot) => {
                const flat = indexOf(face, slot);
                if (includeOnlyIndices && !includeOnlyIndices.has(flat)) return null;
                if (excludeIndices?.has(flat)) return null;

                const isCenter = slot === 0;
                const mark = isCenter ? null : marks[flat] ?? null;
                const isWin = winningIndices?.has(flat) ?? false;
                const isPending = pendingIndex === flat;
                const designIdx = mark !== null ? designs?.[mark] ?? mark : null;

                // Empty pieces show the face color (so users can tell the 12 faces apart);
                // marked pieces show the player's avatar color over it. Center always gets
                // the face color since it's never playable.
                const baseColor = isCenter
                    ? faceColor
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
                        clickable={!isCenter && interactive && (mark === null || isPending)}
                        onClick={() => onCellClick?.(face, slot)}
                    />
                );
            })}

            {/* Center rotation buttons — overlay on top of the center pentagon piece */}
            {showCenterButton && (
                <CenterButton
                    position={liftAlongNormal(center, normal, 0.025)}
                    normal={normal}
                    interactive={interactive}
                    onCcw={() => onRotate?.(face, 'ccw')}
                    onCw={() => onRotate?.(face, 'cw')}
                />
            )}
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

/**
 * One Megaminx piece (center pentagon, corner quad, or edge quad). Built from
 * the polygon returned by `cellPolygon(face, slot)` and lifted slightly along
 * the face's outward normal so it floats above the black grout backdrop.
 */
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

    // Fan-triangulate the (possibly 4- or 5-vertex) polygon from its centroid.
    // Lift the whole tile along the face's outward normal so it sits above
    // the black backdrop. Without this lift the tile and backdrop z-fight.
    const geometry = useMemo(() => {
        const lift = 0.018;
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

    // Glyph orientation: flat plane in the face's tangent plane, facing outward.
    const glyphQuaternion = useMemo(() => {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
        return q;
    }, [normal[0], normal[1], normal[2]]);
    const glyphPosition = useMemo(() => liftAlongNormal(centroid, normal, 0.025), [centroid, normal[0], normal[1], normal[2]]);

    // Glyph size scales with the piece's "radius" (distance from centroid to
    // the closest polygon vertex) so corners and edges get equally legible glyphs.
    const glyphSize = useMemo(() => {
        let minDistSq = Infinity;
        for (const v of polygon) {
            const dx = v[0] - centroid[0];
            const dy = v[1] - centroid[1];
            const dz = v[2] - centroid[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < minDistSq) minDistSq = d2;
        }
        return Math.sqrt(minDistSq) * 1.1;
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

interface CenterButtonProps {
    position: Vec3;
    normal: Vec3;
    interactive: boolean;
    onCcw: () => void;
    onCw: () => void;
}

function CenterButton({ position, normal, interactive, onCcw, onCw }: CenterButtonProps) {
    const quaternion = useMemo(() => {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
        return q;
    }, [normal[0], normal[1], normal[2]]);

    const half = 0.16;

    return (
        <group position={position} quaternion={quaternion}>
            {/* Background disc */}
            <mesh>
                <circleGeometry args={[half * 1.4, 24]} />
                <meshStandardMaterial color="#1f2937" roughness={0.6} />
            </mesh>

            {/* CCW (left) half */}
            <mesh
                position={[-half * 0.45, 0, 0.002]}
                onPointerDown={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    if (interactive) onCcw();
                }}
            >
                <planeGeometry args={[half * 1.1, half * 1.6]} />
                <meshBasicMaterial color={interactive ? '#10b981' : '#475569'} transparent opacity={0.9} />
            </mesh>
            <GlyphSprite glyph="↺" color="#ffffff" size={half * 1.2} offsetX={-half * 0.45} offsetZ={0.004} />

            {/* CW (right) half */}
            <mesh
                position={[half * 0.45, 0, 0.002]}
                onPointerDown={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    if (interactive) onCw();
                }}
            >
                <planeGeometry args={[half * 1.1, half * 1.6]} />
                <meshBasicMaterial color={interactive ? '#3b82f6' : '#475569'} transparent opacity={0.9} />
            </mesh>
            <GlyphSprite glyph="↻" color="#ffffff" size={half * 1.2} offsetX={half * 0.45} offsetZ={0.004} />
        </group>
    );
}

// ---------------------------------------------------------------------------

interface GlyphSpriteProps {
    glyph: string;
    color: string;
    size: number;
    offsetX?: number;
    offsetZ?: number;
}

function GlyphSprite({ glyph, color, size, offsetX = 0, offsetZ = 0.002 }: GlyphSpriteProps) {
    // Use a sprite-via-canvas-texture for crisp glyphs without depending on @react-three/drei's <Text> font loading.
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, 128, 128);
            ctx.fillStyle = color;
            ctx.font = 'bold 96px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyph, 64, 70);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [glyph, color]);

    return (
        <mesh position={[offsetX, 0, offsetZ]}>
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial map={texture} transparent />
        </mesh>
    );
}

// ---------------------------------------------------------------------------

function liftAlongNormal(pos: Vec3, normal: Vec3, amount: number): Vec3 {
    return [pos[0] + normal[0] * amount, pos[1] + normal[1] * amount, pos[2] + normal[2] * amount];
}
