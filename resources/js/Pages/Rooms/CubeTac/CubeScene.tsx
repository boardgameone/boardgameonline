/**
 * The 3D CubeTac cube scene (React Three Fiber).
 *
 * Transparent canvas background so the parent page's gradient shows
 * through, bright lighting, navy matte cubies with self-lit glyphs.
 *
 * Rotation animation is handled internally: the parent calls the imperative
 * `playMove(move)` handle via a ref, and CubeScene splits the 9 layer cubies
 * plus 21 band stickers into a `<RotatingLayer>` group driven by `useFrame`.
 * `displayedMarks` is buffered so the marks prop can update freely without
 * causing a mid-animation snap — the handoff at t=1 advances displayedMarks
 * via `apply()` atomically.
 *
 * Click, hover, pop-in, last-move and win-line feedback come from the
 * shared helpers in `sceneInteraction.tsx`.
 */

import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
    ReactNode,
    Suspense,
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    FACE_B,
    FACE_D,
    FACE_F,
    FACE_L,
    FACE_R,
    FACE_U,
    Face,
    Mark,
    Marks,
    Move,
    apply,
    faceNormal,
    faceRowCol,
    indexOf,
    moveParams,
    sticker3D,
} from '@/lib/rubikCube';
import MarkGlyph from './MarkGlyph';
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

const FACE_DISPLAY_NAMES: Record<Face, string> = {
    0: 'Up',
    1: 'Down',
    2: 'Left',
    3: 'Right',
    4: 'Front',
    5: 'Peeché',
};

const FACE_CENTER_LETTER: Record<Face, string> = {
    0: 'U',
    1: 'D',
    2: 'L',
    3: 'R',
    4: 'F',
    5: 'P',
};

const FACE_LABEL_COLORS: Record<Face, { bg: string; text: string }> = {
    0: { bg: '#14b8a6', text: '#ffffff' }, // teal
    1: { bg: '#8b5cf6', text: '#ffffff' }, // violet
    2: { bg: '#10b981', text: '#ffffff' }, // emerald
    3: { bg: '#0ea5e9', text: '#ffffff' }, // sky
    4: { bg: '#ec4899', text: '#ffffff' }, // pink
    5: { bg: '#f59e0b', text: '#1f2937' }, // amber (dark text — light hue)
};

export type StickerClickHandler = (face: number, row: number, col: number) => void;

export interface CubeSceneHandle extends SceneViewHandle {
    /** Queue a rotation animation. Resolves when this specific move finishes. */
    playMove: (move: Move) => Promise<void>;
}

interface CubeSceneProps {
    marks: Marks;
    /**
     * Hex colors indexed by slot (0..N-1). `playerColors[mark]` is the
     * glyph color for any non-null `mark` in `marks`. Length should equal
     * the number of players in the game; a missing entry falls back to a
     * neutral gray.
     */
    playerColors: string[];
    /**
     * Glyph-design indices (0..5) indexed by slot — lets each player pick
     * X / O / △ / ▢ / ✚ / ⬡ independently of their turn-order slot. A
     * missing entry falls back to the slot index itself.
     */
    designs?: number[];
    winningIndices?: Set<number>;
    /**
     * When the current player has placed a mark but not yet confirmed,
     * the sticker at this flat index renders translucent + outlined to
     * signal "tentative — tap again to undo." `null` when nothing is
     * pending (or viewer isn't the current player).
     */
    pendingIndex?: number | null;
    onStickerClick?: StickerClickHandler;
    interactive: boolean;
    /** Each winning line as flat indices; drawn as a glowing stroke. */
    winLines?: number[][];
    /** Translucent preview of the viewer's glyph on the hovered empty sticker. */
    ghost?: { color: string; design: number } | null;
    /** Most recent mark — gets a pulsing outline. */
    lastMoveIndex?: number | null;
    /** `${moveId}:${index}` of the newest mark so its glyph pops in once. */
    popToken?: string | null;
    /** Move whose layer is being previewed (rotate-button hover). */
    highlightMove?: Move | null;
    /** An opponent's rotation to replay; a new `id` triggers the animation. */
    remoteMove?: { id: number; move: Move } | null;
    autoRotate?: boolean;
    controlsEnabled?: boolean;
}

const FALLBACK_GLYPH_COLOR = '#94a3b8'; // slate-400

interface Animation {
    move: Move;
    axis: THREE.Vector3; // unit vector
    targetAngle: number; // signed radians, taken verbatim from moveParams()
    startTime: number;   // performance.now() when the animation began
    duration: number;    // milliseconds
    resolve: () => void; // fulfilled when the animation commits
}

const DEFAULT_DURATION_MS = 280;

const CubeScene = forwardRef<CubeSceneHandle, CubeSceneProps>(function CubeScene(
    {
        marks,
        playerColors,
        designs,
        winningIndices,
        pendingIndex,
        onStickerClick,
        interactive,
        winLines,
        ghost = null,
        lastMoveIndex = null,
        popToken = null,
        highlightMove = null,
        remoteMove = null,
        autoRotate = false,
        controlsEnabled = true,
    },
    ref,
) {
    const [displayedMarks, setDisplayedMarks] = useState<Marks>(marks);
    const [animation, setAnimation] = useState<Animation | null>(null);
    const queueRef = useRef<Array<{ move: Move; resolve: () => void }>>([]);
    const isAnimatingRef = useRef(false);
    const marksRef = useRef(marks);
    const marksAtQueueStartRef = useRef<Marks>(marks);
    const forceReconcileRef = useRef(false);
    const cameraRef = useRef<SceneCameraHandle>(null);
    const seenRemoteIdRef = useRef<number | null>(remoteMove?.id ?? null);

    // Always track the latest marks prop so completion handlers can reconcile.
    marksRef.current = marks;

    const startNext = useCallback(() => {
        const next = queueRef.current.shift();
        if (!next) {
            isAnimatingRef.current = false;
            // Reconcile with the authoritative prop only if it changed while
            // we were animating (or a remote replay asked for it). Otherwise
            // keep the locally-applied result so a slow POST doesn't snap
            // the board back to the pre-rotation marks for a frame.
            const shouldReconcile = forceReconcileRef.current
                || !marksEqual(marksRef.current, marksAtQueueStartRef.current);
            forceReconcileRef.current = false;
            if (shouldReconcile) {
                setDisplayedMarks(marksRef.current);
            }
            return;
        }
        const { move, resolve } = next;
        const { axis, angle } = moveParams()[move];
        isAnimatingRef.current = true;
        setAnimation({
            move,
            axis: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(),
            targetAngle: angle,
            startTime: performance.now(),
            duration: DEFAULT_DURATION_MS,
            resolve,
        });
    }, []);

    const onAnimationComplete = useCallback(() => {
        setAnimation((current) => {
            if (!current) return null;
            setDisplayedMarks((prev) => apply(current.move, prev));
            current.resolve();
            // Drain the queue on the next microtask so React can commit the
            // current render (removing <RotatingLayer>, advancing marks)
            // before we mount the next animation's rotating group.
            queueMicrotask(startNext);
            return null;
        });
    }, [startNext]);

    const playMove = useCallback(
        (move: Move) =>
            new Promise<void>((resolve) => {
                if (!isAnimatingRef.current && queueRef.current.length === 0) {
                    marksAtQueueStartRef.current = marksRef.current;
                }
                queueRef.current.push({ move, resolve });
                if (!isAnimatingRef.current) {
                    startNext();
                }
            }),
        [startNext],
    );

    // Opponent rotation replay. Declared before the idle-sync effect so the
    // queue is already busy when that effect sees the post-rotation marks.
    useEffect(() => {
        if (!remoteMove || remoteMove.id === seenRemoteIdRef.current) return;
        seenRemoteIdRef.current = remoteMove.id;
        forceReconcileRef.current = true;
        playMove(remoteMove.move);
    }, [remoteMove, playMove]);

    // Idle sync: when no animation is running or queued, accept the prop
    // directly. During an animation this is a no-op and `startNext`
    // reconciles from `marksRef` at drain time.
    useEffect(() => {
        if (!isAnimatingRef.current && queueRef.current.length === 0) {
            setDisplayedMarks(marks);
        }
    }, [marks]);

    useImperativeHandle(ref, () => ({
        playMove,
        idle: () => waitUntilIdle(() => isAnimatingRef.current || queueRef.current.length > 0),
        lookAtFace: (face) => cameraRef.current?.lookAt(faceNormal(face)),
        resetView: () => cameraRef.current?.reset(),
    }), [playMove]);

    const winLineSpecs = useMemo<WinLineSpec[]>(() => {
        if (!winLines?.length) return [];
        return winLines.map((cells) => {
            const owner = displayedMarks[cells[0]];
            return {
                points: cells.map((idx) => stickerSurfacePoint(idx, 0.62)),
                color: owner !== null && owner !== undefined ? playerColors[owner] ?? '#ffffff' : '#ffffff',
            };
        });
    }, [winLines, displayedMarks, playerColors]);

    return (
        <Canvas
            camera={{ position: [4.8, 3.8, 5.2], fov: 40 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ background: 'transparent' }}
        >
            <ambientLight intensity={0.9} />
            <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow />
            <directionalLight position={[-5, -3, -3]} intensity={0.35} color="#ffe8d6" />
            <pointLight position={[-4, 4, -3]} intensity={0.5} color="#5b9bd5" distance={16} />
            <pointLight position={[4, -2, 3]} intensity={0.5} color="#ff8a3d" distance={16} />

            {/* The HDR is fetched from a CDN; keep it in its own boundary so
                the cube renders immediately instead of waiting on it. */}
            <Suspense fallback={null}>
                <Environment preset="apartment" />
            </Suspense>
            <Suspense fallback={null}>
                <CubeRoot
                    marks={displayedMarks}
                    playerColors={playerColors}
                    designs={designs}
                    animation={animation}
                    onAnimationComplete={onAnimationComplete}
                    winningIndices={winningIndices}
                    pendingIndex={pendingIndex ?? null}
                    onStickerClick={interactive && !animation ? onStickerClick : undefined}
                    ghost={ghost}
                    lastMoveIndex={lastMoveIndex}
                    popToken={popToken}
                    highlightMove={animation ? null : highlightMove}
                    showLabels={!autoRotate}
                />
                {winLineSpecs.length > 0 && !animation && <WinLines lines={winLineSpecs} />}
            </Suspense>

            <SceneCamera
                ref={cameraRef}
                minDistance={5.8}
                maxDistance={11}
                minPolarAngle={Math.PI * 0.18}
                maxPolarAngle={Math.PI * 0.82}
                autoRotate={autoRotate}
                enabled={controlsEnabled}
                arrowKeys={!autoRotate}
            />
        </Canvas>
    );
});

export default CubeScene;

// -----------------------------------------------------------------------------
// CubeRoot — renders all 26 cubies + their visible stickers, splitting the
// rotating layer into a <RotatingLayer> subgroup while an animation is active.
// -----------------------------------------------------------------------------

type StickerSpec = { face: Face; row: number; col: number };

interface CubeRootProps {
    marks: Marks;
    playerColors: string[];
    designs?: number[];
    animation: Animation | null;
    onAnimationComplete: () => void;
    winningIndices?: Set<number>;
    pendingIndex: number | null;
    onStickerClick?: StickerClickHandler;
    ghost: { color: string; design: number } | null;
    lastMoveIndex: number | null;
    popToken: string | null;
    highlightMove: Move | null;
    /** Floating face-name pills; off for auto-rotating previews. */
    showLabels: boolean;
}

const CubeRoot = memo(function CubeRoot({
    marks,
    playerColors,
    designs,
    animation,
    onAnimationComplete,
    winningIndices,
    pendingIndex,
    onStickerClick,
    ghost,
    lastMoveIndex,
    popToken,
    highlightMove,
    showLabels,
}: CubeRootProps) {
    const stickers = useMemo(() => collectStickers(), []);
    const faces: Face[] = [0, 1, 2, 3, 4, 5];

    // Stickers in the layer a hovered rotate button would turn — same
    // dot-product test as the animation split below.
    const highlighted = useMemo(() => {
        if (!highlightMove) return null;
        const [ax, ay, az] = moveParams()[highlightMove].axis;
        const len = Math.hypot(ax, ay, az) || 1;
        const set = new Set<number>();
        for (const s of stickers) {
            const p = sticker3D(s.face, s.row, s.col);
            if ((p[0] * ax + p[1] * ay + p[2] * az) / len >= 0.5) {
                set.add(indexOf(s.face, s.row, s.col));
            }
        }
        return set;
    }, [highlightMove, stickers]);

    // Partition cubies and stickers into { inLayer, static } whenever an
    // animation starts or ends. This dot-product test mirrors the one used
    // in `generatePermutations()` at rubikCube.ts:149, so it catches the same
    // 9 face cubies + 21 face/band stickers that `apply()` will permute.
    const { cubiesInLayer, cubiesStatic, stickersInLayer, stickersStatic } = useMemo(() => {
        if (!animation) {
            return {
                cubiesInLayer: [] as Array<[number, number, number]>,
                cubiesStatic: allCubiePositions(),
                stickersInLayer: [] as StickerSpec[],
                stickersStatic: stickers,
            };
        }
        const ax = animation.axis;
        const dot = (v: [number, number, number]) => v[0] * ax.x + v[1] * ax.y + v[2] * ax.z;

        const cIn: Array<[number, number, number]> = [];
        const cOut: Array<[number, number, number]> = [];
        for (const p of allCubiePositions()) {
            (dot(p) >= 0.5 ? cIn : cOut).push(p);
        }

        const sIn: StickerSpec[] = [];
        const sOut: StickerSpec[] = [];
        for (const s of stickers) {
            const pos = sticker3D(s.face, s.row, s.col);
            (dot(pos) >= 0.5 ? sIn : sOut).push(s);
        }

        return {
            cubiesInLayer: cIn,
            cubiesStatic: cOut,
            stickersInLayer: sIn,
            stickersStatic: sOut,
        };
    }, [animation, stickers]);

    const renderSticker = (s: StickerSpec) => {
        const idx = indexOf(s.face, s.row, s.col);
        const mark = marks[idx];
        const color = mark !== null && mark !== undefined
            ? playerColors[mark] ?? FALLBACK_GLYPH_COLOR
            : null;
        const design = mark !== null && mark !== undefined
            ? designs?.[mark] ?? mark
            : null;
        const isWinning = winningIndices?.has(idx) ?? false;
        const isPending = pendingIndex === idx;
        const isEmpty = mark === null || mark === undefined;
        return (
            <Sticker
                key={`sticker-${idx}`}
                face={s.face}
                row={s.row}
                col={s.col}
                mark={mark}
                design={design}
                glyphColor={color}
                isWinning={isWinning}
                isPending={isPending}
                isHighlighted={highlighted?.has(idx) ?? false}
                isLastMove={lastMoveIndex === idx && !isEmpty && !isPending}
                popToken={popToken?.endsWith(`:${idx}`) ? popToken : null}
                ghost={isEmpty ? ghost : null}
                clickable={!!onStickerClick && (isEmpty || isPending)}
                onClick={onStickerClick}
            />
        );
    };

    return (
        <group>
            {cubiesStatic.map(([x, y, z]) => (
                <Cubie key={`cubie-${x}-${y}-${z}`} position={[x, y, z]} />
            ))}
            {stickersStatic.map(renderSticker)}

            {animation && (
                <RotatingLayer key={animation.startTime} animation={animation} onComplete={onAnimationComplete}>
                    {cubiesInLayer.map(([x, y, z]) => (
                        <Cubie key={`rcubie-${x}-${y}-${z}`} position={[x, y, z]} />
                    ))}
                    {stickersInLayer.map(renderSticker)}
                </RotatingLayer>
            )}

            {showLabels && faces.map((f) => (
                <FaceLabel key={`label-${f}`} face={f} />
            ))}
        </group>
    );
});

// -----------------------------------------------------------------------------
// RotatingLayer — a <group> whose quaternion is interpolated each frame from
// identity to the move's target axis-angle. At t>=1 it snaps to the exact
// target and notifies the parent, which removes this component and advances
// the displayed marks atomically via apply().
// -----------------------------------------------------------------------------

interface RotatingLayerProps {
    animation: Animation;
    onComplete: () => void;
    children: ReactNode;
}

function RotatingLayer({ animation, onComplete, children }: RotatingLayerProps) {
    const groupRef = useRef<THREE.Group>(null);
    const firedRef = useRef(false);

    useFrame(() => {
        const g = groupRef.current;
        if (!g || firedRef.current) return;
        const elapsed = performance.now() - animation.startTime;
        const tRaw = Math.min(1, elapsed / animation.duration);
        const t = easeInOutCubic(tRaw);
        g.quaternion.setFromAxisAngle(animation.axis, animation.targetAngle * t);
        if (tRaw >= 1) {
            // Snap to the exact target so the final frame matches the
            // post-handoff static render pixel-for-pixel.
            g.quaternion.setFromAxisAngle(animation.axis, animation.targetAngle);
            firedRef.current = true;
            onComplete();
        }
    });

    return <group ref={groupRef}>{children}</group>;
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// -----------------------------------------------------------------------------
// FaceLabel — a DOM pill floating just outside each face's center
// -----------------------------------------------------------------------------

interface FaceLabelProps {
    face: Face;
}

function FaceLabel({ face }: FaceLabelProps) {
    const normal = faceNormal(face);
    const offset = 2.25;
    const position: [number, number, number] = [
        normal[0] * offset,
        normal[1] * offset,
        normal[2] * offset,
    ];
    const label = FACE_DISPLAY_NAMES[face];
    const colors = FACE_LABEL_COLORS[face];

    // Camera-facing visibility: deterministic per-frame dot test instead of
    // drei's raycast-based `occlude`, which can misfire when CubeScene is
    // remounted (e.g. after Play Again) before the cubie meshes register in
    // the scene graph and briefly leaves every label visible.
    const divRef = useRef<HTMLDivElement>(null);
    const camera = useThree((s) => s.camera);
    const toCamera = useMemo(() => new THREE.Vector3(), []);

    useFrame(() => {
        const el = divRef.current;
        if (!el) return;
        toCamera
            .set(
                camera.position.x - position[0],
                camera.position.y - position[1],
                camera.position.z - position[2],
            )
            .normalize();
        const facing = normal[0] * toCamera.x + normal[1] * toCamera.y + normal[2] * toCamera.z;
        el.style.visibility = facing > 0.05 ? 'visible' : 'hidden';
    });

    return (
        <Html
            position={position}
            center
            distanceFactor={8}
            // drei only honours `pointerEvents` in transform mode; without
            // these the label's wrapper boxes swallow clicks on stickers
            // underneath (even for labels hidden behind the cube).
            wrapperClass="pointer-events-none"
            style={{ pointerEvents: 'none' }}
            zIndexRange={[10, 0]}
        >
            <div
                ref={divRef}
                className="pointer-events-none select-none"
                style={{
                    transform: 'translate(-50%, -50%)',
                    whiteSpace: 'nowrap',
                    background: colors.bg,
                    borderRadius: '6px',
                    padding: '3px 10px',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.22)',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    color: colors.text,
                }}
            >
                {label}
            </div>
        </Html>
    );
}

export { FACE_DISPLAY_NAMES, FACE_LABEL_COLORS };

// -----------------------------------------------------------------------------
// Cubie — a soft matte box
// -----------------------------------------------------------------------------

interface CubieProps {
    position: [number, number, number];
}

const CUBIE_SIZE = 0.96;

function Cubie({ position }: CubieProps) {
    return (
        <mesh position={position} castShadow receiveShadow>
            <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
            <meshStandardMaterial
                color="#1a3a8a"
                metalness={0.0}
                roughness={0.85}
            />
            {/* Edge outline */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE)]} />
                <lineBasicMaterial color="#ffffff" transparent opacity={0.35} />
            </lineSegments>
        </mesh>
    );
}

// -----------------------------------------------------------------------------
// Sticker — a flat plate on a cubie's face, with optional slot glyph
// -----------------------------------------------------------------------------

interface StickerProps {
    face: Face;
    row: number;
    col: number;
    mark: Mark;
    /** Glyph-design index (0..5) for this mark, or null if the sticker is empty. */
    design: number | null;
    /** Hex color for the glyph when mark is non-null; null otherwise. */
    glyphColor: string | null;
    isWinning: boolean;
    /** Current player's unconfirmed mark — renders translucent + outlined. */
    isPending: boolean;
    /** In the layer a hovered rotate button would turn. */
    isHighlighted: boolean;
    /** The most recent mark — gets a pulsing outline in the owner's color. */
    isLastMove: boolean;
    popToken: string | null;
    ghost: { color: string; design: number } | null;
    /** Tapping does something (mark an empty sticker or undo the pending one). */
    clickable: boolean;
    onClick?: StickerClickHandler;
}

const STICKER_SIZE = 0.84;
const STICKER_OFFSET = 0.49;
const GLYPH_OFFSET = 0.06;

const STICKER_OUTLINE: Vec3[] = [
    [-STICKER_SIZE / 2, -STICKER_SIZE / 2, 0.012],
    [STICKER_SIZE / 2, -STICKER_SIZE / 2, 0.012],
    [STICKER_SIZE / 2, STICKER_SIZE / 2, 0.012],
    [-STICKER_SIZE / 2, STICKER_SIZE / 2, 0.012],
];

function Sticker({
    face,
    row,
    col,
    mark,
    design,
    glyphColor,
    isWinning,
    isPending,
    isHighlighted,
    isLastMove,
    popToken,
    ghost,
    clickable,
    onClick,
}: StickerProps) {
    const hover = useCellHover(clickable);

    const { position, rotation } = useMemo(() => {
        const cubiePos = sticker3D(face, row, col);
        const normal = faceNormal(face);
        const pos: [number, number, number] = [
            cubiePos[0] + STICKER_OFFSET * normal[0],
            cubiePos[1] + STICKER_OFFSET * normal[1],
            cubiePos[2] + STICKER_OFFSET * normal[2],
        ];
        const rot = new THREE.Euler();
        const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(normal[0], normal[1], normal[2]),
        );
        rot.setFromQuaternion(quat);
        return { position: pos, rotation: rot };
    }, [face, row, col]);

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        // Forward taps — the parent decides whether to mark, undo, or ignore
        // based on game state. Drags (orbiting the camera) are swallowed.
        if (!onClick) return;
        e.stopPropagation();
        if (isTap(e)) onClick(face, row, col);
    };

    // Navy plate; a winning sticker glows the owner's color via emissive so
    // the line pops on any palette. Hover / ghost / layer-preview states
    // reuse the same channel at lower intensity.
    const showGhost = hover.hovered && clickable && ghost !== null;
    const stickerColor = mark === null ? '#0f2a7a' : '#1a3585';
    const emissive = isWinning && glyphColor
        ? glyphColor
        : showGhost
            ? ghost.color
            : isHighlighted
                ? '#fde047'
                : hover.hovered && clickable
                    ? '#ffffff'
                    : '#000000';
    const emissiveIntensity = isWinning ? 0.9 : showGhost ? 0.3 : isHighlighted ? 0.22 : hover.hovered && clickable ? 0.15 : 0;

    return (
        <group position={position} rotation={rotation}>
            <mesh onClick={handleClick} onPointerOver={hover.onPointerOver} onPointerOut={hover.onPointerOut}>
                <planeGeometry args={[STICKER_SIZE, STICKER_SIZE]} />
                <meshStandardMaterial
                    color={stickerColor}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                    metalness={0.0}
                    roughness={0.85}
                />
            </mesh>

            {/* Frame — quiet grey by default. When pending, layer a second
                slightly-larger outline in the player color so the "tap again
                to undo" cue is clear without a noisy animated halo. */}
            <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE)]} />
                <lineBasicMaterial color="#8ba3c9" transparent opacity={0.35} />
            </lineSegments>
            {(isPending || isLastMove) && glyphColor && (
                <PulseOutline points={STICKER_OUTLINE} color={glyphColor} width={isPending ? 2.5 : 3.5} />
            )}

            {mark !== null && mark !== undefined && (
                <PopIn token={popToken}>
                    <MarkGlyph
                        design={design ?? mark}
                        color={glyphColor ?? FALLBACK_GLYPH_COLOR}
                        opacity={isPending ? 0.55 : 1}
                    />
                </PopIn>
            )}

            {showGhost && (
                <MarkGlyph design={ghost.design} color={ghost.color} opacity={0.35} />
            )}

            {row === 1 && col === 1 && (mark === null || mark === undefined) && !showGhost && (
                <Text
                    position={[0, 0, GLYPH_OFFSET]}
                    fontSize={0.5}
                    anchorX="center"
                    anchorY="middle"
                    color="#cfd8ff"
                    characters="UDLRFP"
                >
                    {FACE_CENTER_LETTER[face]}
                </Text>
            )}
        </group>
    );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** World-space point floating `offset` above the center of sticker `idx`. */
function stickerSurfacePoint(idx: number, offset: number): Vec3 {
    const [face, row, col] = faceRowCol(idx);
    const p = sticker3D(face, row, col);
    const n = faceNormal(face);
    return [p[0] + n[0] * offset, p[1] + n[1] * offset, p[2] + n[2] * offset];
}

function allCubiePositions(): Array<[number, number, number]> {
    const out: Array<[number, number, number]> = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue;
                out.push([x, y, z]);
            }
        }
    }
    return out;
}

function collectStickers(): Array<{ face: Face; row: number; col: number }> {
    const out: Array<{ face: Face; row: number; col: number }> = [];
    const faces: Face[] = [FACE_U, FACE_D, FACE_L, FACE_R, FACE_F, FACE_B];
    for (const face of faces) {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                out.push({ face, row, col });
            }
        }
    }
    return out;
}
