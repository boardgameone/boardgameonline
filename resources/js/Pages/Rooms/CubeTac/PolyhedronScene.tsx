/**
 * Shared 3D renderer for the slot-based CubeTac variants — Megaminx,
 * Pyraminx, Octahedron and Icosahedron. Each variant file is a thin wrapper
 * that passes its geometry module plus a few look-and-feel knobs in a
 * `PolyhedronConfig`.
 *
 * Every face is a dark "grout" polygon with `CELLS_PER_FACE` lifted piece
 * tiles on top. Rotation is a short spin of the affected cells (the face's
 * own cells plus the first ring on its neighbors) driven by `useFrame`.
 *
 * `displayedMarks` is buffered exactly like CubeScene: while a rotation is
 * playing, incoming marks props are held back and reconciled once the queue
 * drains, so neither our own rotations nor replayed opponent rotations
 * snap mid-spin.
 */

import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import MarkGlyph, { GLYPH_REFERENCE_HALF_WIDTH } from './MarkGlyph';
import {
    PopIn,
    PulseOutline,
    SceneCamera,
    type SceneCameraHandle,
    type SceneViewHandle,
    type Vec3,
    type WinLineSpec,
    WinLines,
    isTap,
    marksEqual,
    useCellHover,
    waitUntilIdle,
} from './sceneInteraction';

export type Direction = 'cw' | 'ccw';
type Marks = Array<number | null>;

/** The parts of a `@/lib/<variant>.ts` module the renderer needs. */
export interface PolyhedronGeometry {
    FACES: number;
    CELLS_PER_FACE: number;
    indexOf: (face: number, slot: number) => number;
    apply: (face: number, direction: Direction, marks: Marks) => Marks;
    vertices: () => Vec3[];
    faceVertices: () => number[][];
    faceCenters: () => Vec3[];
    faceNormals: () => Vec3[];
    firstRingCells: (face: number) => number[];
    moveKey: (face: number, direction: Direction) => string;
    moveParams: () => Record<string, { axis: Vec3; angle: number }>;
    cellPolygon: (face: number, slot: number) => Vec3[];
    cellCentroid: (face: number, slot: number) => Vec3;
}

export interface PolyhedronConfig {
    geometry: PolyhedronGeometry;
    faceColors: string[];
    /** Whether a slot can ever hold a mark. */
    isPlayableSlot: (slot: number) => boolean;
    /** Tile color for unplayable slots: a fixed hex, or `'face'` to use the face color. */
    deadSlotColor: string | 'face';
    camera: { position: Vec3; fov: number };
    minDistance: number;
    maxDistance: number;
    animationMs: number;
    tileLift: number;
    glyphLift: number;
    /** Glyph half-width as a multiple of the piece's inradius. */
    glyphScale: number;
    /** Megaminx: ↺ / ↻ buttons on each face's center pentagon. */
    centerButtons: boolean;
}

export type CellClickHandler = (face: number, slot: number) => void;
export type RotateHandler = (face: number, direction: Direction) => void;

export interface PolyhedronSceneHandle extends SceneViewHandle {
    /** Animate a face rotation locally; the new marks come back via the next prop update. */
    playMove: (face: number, direction: Direction) => Promise<void>;
}

export interface PolyhedronSceneProps {
    marks: Marks;
    /** Hex colors indexed by slot. */
    playerColors: string[];
    /** Glyph-design indices (0..5) indexed by slot. */
    designs?: number[];
    /** Winning cells to highlight (flat indices). */
    winningIndices?: Set<number>;
    /** Each winning line as flat indices; drawn as a glowing stroke. */
    winLines?: number[][];
    /** Pending mark (cell the current player can tap again to undo). */
    pendingIndex?: number | null;
    onCellClick?: CellClickHandler;
    onRotate?: RotateHandler;
    /** True when the current viewer can act this turn. */
    interactive: boolean;
    /** Translucent preview of the viewer's glyph on the hovered empty cell. */
    ghost?: { color: string; design: number } | null;
    /** Most recent mark — gets a pulsing outline. */
    lastMoveIndex?: number | null;
    /** `${moveId}:${index}` of the newest mark so its glyph pops in once. */
    popToken?: string | null;
    /** Face whose rotation is being previewed (rotate-button hover). */
    highlightFace?: number | null;
    /** An opponent's rotation to replay; a new `id` triggers the animation. */
    remoteMove?: { id: number; face: number; direction: Direction } | null;
    autoRotate?: boolean;
    controlsEnabled?: boolean;
}

interface Animation {
    face: number;
    direction: Direction;
    startTime: number;
    resolve: () => void;
}

const FALLBACK_GLYPH_COLOR = '#94a3b8';
const HIGHLIGHT_EMISSIVE = '#fde047';

function affectedCells(geometry: PolyhedronGeometry, face: number): number[] {
    const out: number[] = [];
    for (let s = 0; s < geometry.CELLS_PER_FACE; s++) {
        out.push(geometry.indexOf(face, s));
    }
    out.push(...geometry.firstRingCells(face));
    return out;
}

function liftAlongNormal(pos: Vec3, normal: Vec3, amount: number): Vec3 {
    return [pos[0] + normal[0] * amount, pos[1] + normal[1] * amount, pos[2] + normal[2] * amount];
}

/** Shortest distance from `center` to any edge of `polygon`. */
function inradius(polygon: Vec3[], center: Vec3): number {
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ac: Vec3 = [center[0] - a[0], center[1] - a[1], center[2] - a[2]];
        const lenSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
        const t = Math.max(0, Math.min(1, (ac[0] * ab[0] + ac[1] * ab[1] + ac[2] * ab[2]) / lenSq));
        const d = Math.hypot(ac[0] - ab[0] * t, ac[1] - ab[1] * t, ac[2] - ab[2] * t);
        if (d < best) best = d;
    }
    return best;
}

const PolyhedronScene = forwardRef<PolyhedronSceneHandle, PolyhedronSceneProps & { config: PolyhedronConfig }>(
    function PolyhedronScene(
        {
            config,
            marks,
            playerColors,
            designs,
            winningIndices,
            winLines,
            pendingIndex = null,
            onCellClick,
            onRotate,
            interactive,
            ghost = null,
            lastMoveIndex = null,
            popToken = null,
            highlightFace = null,
            remoteMove = null,
            autoRotate = false,
            controlsEnabled = true,
        },
        ref,
    ) {
        const { geometry } = config;
        const [displayedMarks, setDisplayedMarks] = useState<Marks>(marks);
        const [animation, setAnimation] = useState<Animation | null>(null);
        const queueRef = useRef<Array<{ face: number; direction: Direction; resolve: () => void }>>([]);
        const isAnimatingRef = useRef(false);
        const marksRef = useRef(marks);
        const marksAtQueueStartRef = useRef<Marks>(marks);
        const forceReconcileRef = useRef(false);
        const cameraRef = useRef<SceneCameraHandle>(null);
        const seenRemoteIdRef = useRef<number | null>(remoteMove?.id ?? null);

        marksRef.current = marks;

        const startNext = useCallback(() => {
            const next = queueRef.current.shift();
            if (!next) {
                isAnimatingRef.current = false;
                // Reconcile with the authoritative prop only if it actually
                // changed while we were spinning (or a remote replay asked
                // for it). Otherwise keep our locally-applied result so a
                // slow POST doesn't snap the board back for a frame.
                const shouldReconcile = forceReconcileRef.current
                    || !marksEqual(marksRef.current, marksAtQueueStartRef.current);
                forceReconcileRef.current = false;
                if (shouldReconcile) {
                    setDisplayedMarks(marksRef.current);
                }
                return;
            }
            isAnimatingRef.current = true;
            setAnimation({ face: next.face, direction: next.direction, startTime: performance.now(), resolve: next.resolve });
        }, []);

        const onAnimationComplete = useCallback(() => {
            setAnimation((current) => {
                if (!current) return null;
                setDisplayedMarks((prev) => geometry.apply(current.face, current.direction, prev));
                current.resolve();
                queueMicrotask(startNext);
                return null;
            });
        }, [geometry, startNext]);

        const playMove = useCallback(
            (face: number, direction: Direction) =>
                new Promise<void>((resolve) => {
                    if (!isAnimatingRef.current && queueRef.current.length === 0) {
                        marksAtQueueStartRef.current = marksRef.current;
                    }
                    queueRef.current.push({ face, direction, resolve });
                    if (!isAnimatingRef.current) startNext();
                }),
            [startNext],
        );

        // Opponent rotation replay. Declared before the idle-sync effect so
        // the queue is already busy when that effect sees the new marks.
        useEffect(() => {
            if (!remoteMove || remoteMove.id === seenRemoteIdRef.current) return;
            seenRemoteIdRef.current = remoteMove.id;
            forceReconcileRef.current = true;
            playMove(remoteMove.face, remoteMove.direction);
        }, [remoteMove, playMove]);

        useEffect(() => {
            if (!isAnimatingRef.current && queueRef.current.length === 0) {
                setDisplayedMarks(marks);
            }
        }, [marks]);

        useImperativeHandle(ref, () => ({
            playMove,
            idle: () => waitUntilIdle(() => isAnimatingRef.current || queueRef.current.length > 0),
            lookAtFace: (face) => cameraRef.current?.lookAt(geometry.faceNormals()[face]),
            resetView: () => cameraRef.current?.reset(),
        }), [playMove, geometry]);

        const winLineSpecs = useMemo<WinLineSpec[]>(() => {
            if (!winLines?.length) return [];
            const normals = geometry.faceNormals();
            return winLines.map((cells) => {
                const owner = displayedMarks[cells[0]];
                const points = cells.map((idx) => {
                    const face = Math.floor(idx / geometry.CELLS_PER_FACE);
                    const slot = idx % geometry.CELLS_PER_FACE;
                    return liftAlongNormal(geometry.cellCentroid(face, slot), normals[face], 0.06);
                });
                return {
                    points,
                    color: owner !== null && owner !== undefined ? playerColors[owner] ?? '#ffffff' : '#ffffff',
                };
            });
        }, [winLines, geometry, displayedMarks, playerColors]);

        return (
            <Canvas
                camera={{ position: config.camera.position, fov: config.camera.fov }}
                gl={{ alpha: true, antialias: true }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 7, 4]} intensity={0.6} />
                <directionalLight position={[-4, -3, -5]} intensity={0.25} />

                <SceneCamera
                    ref={cameraRef}
                    minDistance={config.minDistance}
                    maxDistance={config.maxDistance}
                    autoRotate={autoRotate}
                    enabled={controlsEnabled}
                    arrowKeys={!autoRotate}
                />

                <PolyhedronGroup
                    config={config}
                    marks={displayedMarks}
                    playerColors={playerColors}
                    designs={designs}
                    winningIndices={winningIndices}
                    pendingIndex={pendingIndex}
                    onCellClick={onCellClick}
                    onRotate={onRotate}
                    interactive={interactive && !animation}
                    ghost={ghost}
                    lastMoveIndex={lastMoveIndex}
                    popToken={popToken}
                    highlightFace={highlightFace}
                    animation={animation}
                    onAnimationComplete={onAnimationComplete}
                />

                {winLineSpecs.length > 0 && !animation && <WinLines lines={winLineSpecs} />}
            </Canvas>
        );
    },
);

export default PolyhedronScene;

// ---------------------------------------------------------------------------

interface PolyhedronGroupProps {
    config: PolyhedronConfig;
    marks: Marks;
    playerColors: string[];
    designs?: number[];
    winningIndices?: Set<number>;
    pendingIndex: number | null;
    onCellClick?: CellClickHandler;
    onRotate?: RotateHandler;
    interactive: boolean;
    ghost: { color: string; design: number } | null;
    lastMoveIndex: number | null;
    popToken: string | null;
    highlightFace: number | null;
    animation: Animation | null;
    onAnimationComplete: () => void;
}

const PolyhedronGroup = memo(function PolyhedronGroup({
    config,
    animation,
    onAnimationComplete,
    highlightFace,
    ...shared
}: PolyhedronGroupProps) {
    const { geometry } = config;
    const rotatingGroupRef = useRef<THREE.Group>(null);
    const firedRef = useRef(false);

    const facePolys = useMemo(() => {
        const verts = geometry.vertices();
        return geometry.faceVertices().map((vIndices) => vIndices.map((i) => verts[i]));
    }, [geometry]);
    const centers = useMemo(() => geometry.faceCenters(), [geometry]);
    const normals = useMemo(() => geometry.faceNormals(), [geometry]);

    const affected = useMemo(
        () => (animation ? new Set(affectedCells(geometry, animation.face)) : new Set<number>()),
        [animation, geometry],
    );
    const highlighted = useMemo(
        () => (highlightFace !== null && !animation ? new Set(affectedCells(geometry, highlightFace)) : null),
        [highlightFace, animation, geometry],
    );

    useEffect(() => {
        firedRef.current = false;
    }, [animation]);

    useFrame(() => {
        const grp = rotatingGroupRef.current;
        if (!animation || !grp || firedRef.current) return;
        const t = Math.min(1, (performance.now() - animation.startTime) / config.animationMs);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const params = geometry.moveParams()[geometry.moveKey(animation.face, animation.direction)];
        const axis = new THREE.Vector3(params.axis[0], params.axis[1], params.axis[2]).normalize();
        grp.setRotationFromAxisAngle(axis, params.angle * eased);
        if (t >= 1) {
            firedRef.current = true;
            onAnimationComplete();
        }
    });

    const animatingFace = animation?.face ?? null;

    return (
        <>
            <group>
                {Array.from({ length: geometry.FACES }, (_, f) => (
                    <FaceMesh
                        key={`face-${f}`}
                        config={config}
                        face={f}
                        polygon={facePolys[f]}
                        center={centers[f]}
                        normal={normals[f]}
                        {...shared}
                        highlighted={highlighted}
                        excludeIndices={affected}
                        renderBackdrop={animatingFace === null || f !== animatingFace}
                    />
                ))}
            </group>

            {animation && (
                <group ref={rotatingGroupRef} key={animation.startTime}>
                    {Array.from({ length: geometry.FACES }, (_, f) => (
                        <FaceMesh
                            key={`face-rot-${f}`}
                            config={config}
                            face={f}
                            polygon={facePolys[f]}
                            center={centers[f]}
                            normal={normals[f]}
                            {...shared}
                            onCellClick={undefined}
                            onRotate={undefined}
                            interactive={false}
                            highlighted={null}
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

interface FaceMeshProps extends Omit<PolyhedronGroupProps, 'animation' | 'onAnimationComplete' | 'highlightFace'> {
    face: number;
    polygon: Vec3[];
    center: Vec3;
    normal: Vec3;
    highlighted: Set<number> | null;
    includeOnlyIndices?: Set<number>;
    excludeIndices?: Set<number>;
    renderBackdrop: boolean;
}

function FaceMesh({
    config,
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
    ghost,
    lastMoveIndex,
    popToken,
    highlighted,
    includeOnlyIndices,
    excludeIndices,
    renderBackdrop,
}: FaceMeshProps) {
    const { geometry } = config;

    // Black "grout" polygon behind the pieces — shows through the inset gaps
    // so the surface reads like a real twisty puzzle.
    const backdropGeometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            positions.push(center[0], center[1], center[2], a[0], a[1], a[2], b[0], b[1], b[2]);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        return geo;
    }, [polygon, center]);

    const faceColor = config.faceColors[face % config.faceColors.length];
    const centerFlat = geometry.indexOf(face, 0);
    const showCenterButton = config.centerButtons && !includeOnlyIndices && !excludeIndices?.has(centerFlat);

    return (
        <group>
            {renderBackdrop && (
                <mesh geometry={backdropGeometry}>
                    <meshStandardMaterial color="#0f172a" side={THREE.DoubleSide} roughness={0.85} />
                </mesh>
            )}

            {Array.from({ length: geometry.CELLS_PER_FACE }, (_, slot) => {
                const flat = geometry.indexOf(face, slot);
                if (includeOnlyIndices && !includeOnlyIndices.has(flat)) return null;
                if (excludeIndices?.has(flat)) return null;

                const playable = config.isPlayableSlot(slot);
                const mark = playable ? marks[flat] ?? null : null;
                const ownerColor = mark !== null ? playerColors[mark] ?? FALLBACK_GLYPH_COLOR : null;
                const baseColor = !playable
                    ? (config.deadSlotColor === 'face' ? faceColor : config.deadSlotColor)
                    : ownerColor ?? faceColor;
                const isPending = pendingIndex === flat;

                return (
                    <PieceTile
                        key={`piece-${face}-${slot}`}
                        config={config}
                        face={face}
                        slot={slot}
                        normal={normal}
                        color={baseColor}
                        design={mark !== null ? designs?.[mark] ?? mark : null}
                        glowColor={ownerColor ?? '#ffffff'}
                        isWin={winningIndices?.has(flat) ?? false}
                        isPending={isPending}
                        isMarked={mark !== null}
                        isHighlighted={highlighted?.has(flat) ?? false}
                        isLastMove={lastMoveIndex === flat && mark !== null && !isPending}
                        popToken={popToken?.endsWith(`:${flat}`) ? popToken : null}
                        ghost={mark === null ? ghost : null}
                        clickable={playable && interactive && !!onCellClick && (mark === null || isPending)}
                        onClick={() => onCellClick?.(face, slot)}
                    />
                );
            })}

            {showCenterButton && (
                <CenterButton
                    position={liftAlongNormal(center, normal, 0.025)}
                    normal={normal}
                    interactive={interactive && !!onRotate}
                    onCcw={() => onRotate?.(face, 'ccw')}
                    onCw={() => onRotate?.(face, 'cw')}
                />
            )}
        </group>
    );
}

// ---------------------------------------------------------------------------

interface PieceTileProps {
    config: PolyhedronConfig;
    face: number;
    slot: number;
    normal: Vec3;
    color: string;
    design: number | null;
    glowColor: string;
    isWin: boolean;
    isPending: boolean;
    isMarked: boolean;
    isHighlighted: boolean;
    isLastMove: boolean;
    popToken: string | null;
    ghost: { color: string; design: number } | null;
    clickable: boolean;
    onClick: () => void;
}

function PieceTile({
    config,
    face,
    slot,
    normal,
    color,
    design,
    glowColor,
    isWin,
    isPending,
    isMarked,
    isHighlighted,
    isLastMove,
    popToken,
    ghost,
    clickable,
    onClick,
}: PieceTileProps) {
    const { geometry } = config;
    const polygon = useMemo(() => geometry.cellPolygon(face, slot), [geometry, face, slot]);
    const centroid = useMemo(() => geometry.cellCentroid(face, slot), [geometry, face, slot]);
    const hover = useCellHover(clickable);

    // Fan-triangulate the polygon from its centroid, lifted along the face
    // normal so it floats above the grout backdrop without z-fighting.
    const tileGeometry = useMemo(() => {
        const lifted = polygon.map((v) => liftAlongNormal(v, normal, config.tileLift));
        const c = liftAlongNormal(centroid, normal, config.tileLift);
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (let i = 0; i < lifted.length; i++) {
            const a = lifted[i];
            const b = lifted[(i + 1) % lifted.length];
            positions.push(c[0], c[1], c[2], a[0], a[1], a[2], b[0], b[1], b[2]);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        return geo;
    }, [polygon, centroid, normal, config.tileLift]);

    const outlinePoints = useMemo(
        () => polygon.map((v) => {
            // Pull each vertex slightly toward the centroid so the outline sits inside the grout gap.
            const inset: Vec3 = [
                centroid[0] + (v[0] - centroid[0]) * 0.92,
                centroid[1] + (v[1] - centroid[1]) * 0.92,
                centroid[2] + (v[2] - centroid[2]) * 0.92,
            ];
            return liftAlongNormal(inset, normal, config.tileLift + 0.01);
        }),
        [polygon, centroid, normal, config.tileLift],
    );

    const glyphQuaternion = useMemo(
        () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal)),
        [normal],
    );
    const glyphPosition = useMemo(() => liftAlongNormal(centroid, normal, config.glyphLift), [centroid, normal, config.glyphLift]);

    // Glyph size scales with the piece's inscribed radius (centroid to the
    // nearest edge) so triangles, quads and pentagons all get a glyph that
    // fits inside the piece.
    const glyphScale = useMemo(
        () => (inradius(polygon, centroid) * config.glyphScale) / GLYPH_REFERENCE_HALF_WIDTH,
        [polygon, centroid, config.glyphScale],
    );

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (clickable && isTap(e)) onClick();
    };

    const showGhost = hover.hovered && clickable && !isMarked && ghost !== null;
    const emissive = isWin
        ? color
        : showGhost
            ? ghost.color
            : isHighlighted
                ? HIGHLIGHT_EMISSIVE
                : hover.hovered && clickable
                    ? '#ffffff'
                    : '#000000';
    const emissiveIntensity = isWin ? 0.55 : showGhost ? 0.35 : isHighlighted ? 0.28 : hover.hovered && clickable ? 0.18 : 0;

    return (
        <group>
            <mesh
                geometry={tileGeometry}
                onClick={handleClick}
                onPointerOver={hover.onPointerOver}
                onPointerOut={hover.onPointerOut}
            >
                <meshStandardMaterial
                    color={color}
                    side={THREE.DoubleSide}
                    transparent={isPending}
                    opacity={isPending ? 0.7 : 1}
                    roughness={0.42}
                    metalness={0.04}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>

            {(isLastMove || isPending) && (
                <PulseOutline points={outlinePoints} color={isPending ? '#ffffff' : glowColor} width={isPending ? 2.5 : 3.5} />
            )}

            {design !== null && isMarked && (
                <group position={glyphPosition} quaternion={glyphQuaternion} scale={glyphScale}>
                    <PopIn token={popToken}>
                        <MarkGlyph design={design} color="#0f172a" glowColor={glowColor} opacity={isPending ? 0.65 : 1} />
                    </PopIn>
                </group>
            )}

            {showGhost && (
                <group position={glyphPosition} quaternion={glyphQuaternion} scale={glyphScale}>
                    <MarkGlyph design={ghost.design} color="#0f172a" glowColor={ghost.color} opacity={0.4} />
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

/** Megaminx-only ↺ / ↻ split button on a face's center pentagon. */
function CenterButton({ position, normal, interactive, onCcw, onCw }: CenterButtonProps) {
    const quaternion = useMemo(
        () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal)),
        [normal],
    );
    const half = 0.16;

    return (
        <group position={position} quaternion={quaternion}>
            <mesh>
                <circleGeometry args={[half * 1.4, 24]} />
                <meshStandardMaterial color="#1f2937" roughness={0.6} />
            </mesh>
            <CenterButtonHalf
                offsetX={-half * 0.45}
                half={half}
                glyph="↺"
                color="#10b981"
                interactive={interactive}
                onPress={onCcw}
            />
            <CenterButtonHalf
                offsetX={half * 0.45}
                half={half}
                glyph="↻"
                color="#3b82f6"
                interactive={interactive}
                onPress={onCw}
            />
        </group>
    );
}

interface CenterButtonHalfProps {
    offsetX: number;
    half: number;
    glyph: string;
    color: string;
    interactive: boolean;
    onPress: () => void;
}

function CenterButtonHalf({ offsetX, half, glyph, color, interactive, onPress }: CenterButtonHalfProps) {
    const hover = useCellHover(interactive);
    const lit = interactive && hover.hovered;

    return (
        <>
            <mesh
                position={[offsetX, 0, 0.002]}
                scale={lit ? 1.12 : 1}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    if (interactive && isTap(e)) onPress();
                }}
                onPointerOver={hover.onPointerOver}
                onPointerOut={hover.onPointerOut}
            >
                <planeGeometry args={[half * 1.1, half * 1.6]} />
                <meshBasicMaterial color={interactive ? color : '#475569'} transparent opacity={lit ? 1 : 0.9} />
            </mesh>
            <GlyphSprite glyph={glyph} color="#ffffff" size={half * 1.2} offsetX={offsetX} offsetZ={0.004} />
        </>
    );
}

interface GlyphSpriteProps {
    glyph: string;
    color: string;
    size: number;
    offsetX?: number;
    offsetZ?: number;
}

function GlyphSprite({ glyph, color, size, offsetX = 0, offsetZ = 0.002 }: GlyphSpriteProps) {
    // Canvas-texture sprite: crisp arrows without loading a drei <Text> font.
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
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
        <mesh position={[offsetX, 0, offsetZ]} raycast={() => null}>
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial map={texture} transparent />
        </mesh>
    );
}
