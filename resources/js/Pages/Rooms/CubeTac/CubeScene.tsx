/**
 * The 3D CubeTac cube scene (React Three Fiber).
 *
 * Light-theme variant: transparent canvas background so the parent page's
 * gradient shows through, bright lighting, soft matte cubies with glowing
 * X/O glyphs that read well against a light backdrop.
 *
 * Rotation animation is handled internally: the parent calls the imperative
 * `playMove(move)` handle via a ref, and CubeScene splits the 9 layer cubies
 * plus 21 band stickers into a `<RotatingLayer>` group driven by `useFrame`.
 * `displayedMarks` is buffered so the marks prop can update freely without
 * causing a mid-animation snap — the handoff at t=1 advances displayedMarks
 * via `apply()` atomically.
 */

import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { Environment, Html, OrbitControls, Text } from '@react-three/drei';
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
    indexOf,
    moveParams,
    sticker3D,
} from '@/lib/rubikCube';

const FACE_DISPLAY_NAMES: Record<Face, string> = {
    0: 'Up',
    1: 'Down',
    2: 'Left',
    3: 'Right',
    4: 'Front',
    5: 'Peeche',
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

export interface CubeSceneHandle {
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
    { marks, playerColors, winningIndices, pendingIndex, onStickerClick, interactive },
    ref,
) {
    const [displayedMarks, setDisplayedMarks] = useState<Marks>(marks);
    const [animation, setAnimation] = useState<Animation | null>(null);
    const queueRef = useRef<Array<{ move: Move; resolve: () => void }>>([]);
    const isAnimatingRef = useRef(false);
    const marksRef = useRef(marks);
    // Drei's OrbitControls ref resolves to three's own OrbitControls class;
    // we only need the quarter-turn helpers (`rotateLeft`/`rotateUp`/`update`).
    // Typed loosely and cast at the ref= site below.
    const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
    const heldArrowKeysRef = useRef<Set<string>>(new Set());

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

    // Always track the latest marks prop so completion handlers can reconcile.
    useEffect(() => {
        marksRef.current = marks;
    }, [marks]);

    // Idle sync: when no animation is running or queued, accept the prop
    // directly. During an animation this effect still runs but is a no-op,
    // and `startNext` explicitly reconciles from `marksRef` at drain time.
    useEffect(() => {
        if (!isAnimatingRef.current && queueRef.current.length === 0) {
            setDisplayedMarks(marks);
        }
    }, [marks]);

    const startNext = useCallback(() => {
        const next = queueRef.current.shift();
        if (!next) {
            isAnimatingRef.current = false;
            // Catch any prop updates (e.g. opponent moves via poll) that
            // arrived during the animation sequence.
            setDisplayedMarks((prev) => (marksRef.current !== prev ? marksRef.current : prev));
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
                queueRef.current.push({ move, resolve });
                if (!isAnimatingRef.current) {
                    startNext();
                }
            }),
        [startNext],
    );

    useImperativeHandle(ref, () => ({ playMove }), [playMove]);

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

            <Suspense fallback={null}>
                <Environment preset="apartment" />
                <CubeRoot
                    marks={displayedMarks}
                    playerColors={playerColors}
                    animation={animation}
                    onAnimationComplete={onAnimationComplete}
                    winningIndices={winningIndices}
                    pendingIndex={pendingIndex ?? null}
                    onStickerClick={interactive ? onStickerClick : undefined}
                />
            </Suspense>

            <OrbitControls
                // Drei's ref type is the full three.js OrbitControls; we only
                // need a structural subset — cast to any to avoid pulling in
                // all of three's types for this single prop.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={orbitControlsRef as any}
                makeDefault
                enablePan={false}
                minDistance={5.8}
                maxDistance={11}
                minPolarAngle={Math.PI * 0.18}
                maxPolarAngle={Math.PI * 0.82}
                rotateSpeed={0.7}
            />
            <ArrowKeyOrbit controlsRef={orbitControlsRef} heldKeysRef={heldArrowKeysRef} />
        </Canvas>
    );
});

export default CubeScene;

// -----------------------------------------------------------------------------
// Arrow-key camera orbit — held keys are tracked in a Set and applied every
// frame via `ArrowKeyOrbit` below, so hold-to-rotate mirrors the cadence of
// mouse drag instead of OS key-repeat (which stalls ~500ms before firing).
// -----------------------------------------------------------------------------

const ORBIT_SPEED_RAD_PER_SEC = Math.PI * 6; // ~1080°/sec

// Minimal subset of OrbitControls we call. Drei hands back three-stdlib's
// OrbitControls instance, which exposes spherical-angle getters/setters but
// keeps `rotateLeft` / `rotateUp` as private closures — so we drive the
// camera by reading and writing the azimuthal/polar angles directly.
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

// -----------------------------------------------------------------------------
// CubeRoot — renders all 26 cubies + their visible stickers, splitting the
// rotating layer into a <RotatingLayer> subgroup while an animation is active.
// -----------------------------------------------------------------------------

type StickerSpec = { face: Face; row: number; col: number };

interface CubeRootProps {
    marks: Marks;
    playerColors: string[];
    animation: Animation | null;
    onAnimationComplete: () => void;
    winningIndices?: Set<number>;
    pendingIndex: number | null;
    onStickerClick?: StickerClickHandler;
}

const CubeRoot = memo(function CubeRoot({
    marks,
    playerColors,
    animation,
    onAnimationComplete,
    winningIndices,
    pendingIndex,
    onStickerClick,
}: CubeRootProps) {
    const stickers = useMemo(() => collectStickers(), []);
    const faces: Face[] = [0, 1, 2, 3, 4, 5];

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
        const isWinning = winningIndices?.has(idx) ?? false;
        const isPending = pendingIndex === idx;
        return (
            <Sticker
                key={`sticker-${idx}`}
                face={s.face}
                row={s.row}
                col={s.col}
                mark={mark}
                glyphColor={color}
                isWinning={isWinning}
                isPending={isPending}
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

            {faces.map((f) => (
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

    return (
        <Html
            position={position}
            center
            distanceFactor={8}
            pointerEvents="none"
            zIndexRange={[10, 0]}
            occlude
        >
            <div
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
    /** Hex color for the glyph when mark is non-null; null otherwise. */
    glyphColor: string | null;
    isWinning: boolean;
    /** Current player's unconfirmed mark — renders translucent + outlined. */
    isPending: boolean;
    onClick?: StickerClickHandler;
}

const STICKER_SIZE = 0.84;
const STICKER_OFFSET = 0.49;
const GLYPH_OFFSET = 0.06;

function Sticker({ face, row, col, mark, glyphColor, isWinning, isPending, onClick }: StickerProps) {
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
        // Forward every click — the parent decides whether to mark, undo, or
        // ignore based on game state. CubeScene used to block marked stickers
        // here, but that prevented the "click your pending mark to undo" UX.
        if (!onClick) return;
        e.stopPropagation();
        onClick(face, row, col);
    };

    // Background stays light but slightly off-white so the glyphs read
    // with more contrast. On a winning sticker we glow the owner's color
    // via the emissive channel so the winning line pops on any of the
    // six palettes without having to pre-compute tinted backdrops.
    const stickerColor = mark === null ? '#0f2a7a' : '#1a3585';
    const emissive = isWinning && glyphColor ? glyphColor : '#000000';
    const emissiveIntensity = isWinning ? 0.9 : 0;

    return (
        <group position={position} rotation={rotation}>
            <mesh onClick={handleClick}>
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
            {isPending && glyphColor && (
                <lineSegments position={[0, 0, 0.01]}>
                    <edgesGeometry args={[new THREE.PlaneGeometry(STICKER_SIZE * 1.02, STICKER_SIZE * 1.02)]} />
                    <lineBasicMaterial color={glyphColor} transparent={false} />
                </lineSegments>
            )}

            {mark !== null && mark !== undefined && (
                <MarkGlyph
                    slot={mark}
                    color={glyphColor ?? FALLBACK_GLYPH_COLOR}
                    opacity={isPending ? 0.55 : 1}
                />
            )}

            {row === 1 && col === 1 && (mark === null || mark === undefined) && (
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
// MarkGlyph — one of six extruded slot glyphs, positioned slightly above
// the sticker. Slots 0/1 preserve the original X / O look; slots 2..5 add
// distinct shapes so 3..6-player games stay readable even in screenshots.
// -----------------------------------------------------------------------------

function MarkGlyph({ slot, color, opacity = 1 }: { slot: number; color: string; opacity?: number }) {
    switch (slot) {
        case 0: return <XGlyph color={color} opacity={opacity} />;
        case 1: return <OGlyph color={color} opacity={opacity} />;
        case 2: return <TriangleGlyph color={color} opacity={opacity} />;
        case 3: return <SquareGlyph color={color} opacity={opacity} />;
        case 4: return <PlusGlyph color={color} opacity={opacity} />;
        case 5: return <HexagonGlyph color={color} opacity={opacity} />;
        default: return null;
    }
}

/**
 * Shared material for every glyph — saturated base color with a strong
 * self-lit halo so each of the six palettes reads vividly against the
 * near-white sticker. Emissive is the same hex as `color`, so no extra
 * tinting math is needed per slot. `opacity<1` is used to "ghost" the
 * pending-but-unconfirmed mark.
 */
function glyphMaterial(color: string, opacity = 1) {
    const isTransparent = opacity < 1;
    return (
        <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isTransparent ? 0.8 : 1.15}
            metalness={0.15}
            roughness={0.22}
            toneMapped={false}
            transparent={isTransparent}
            opacity={opacity}
        />
    );
}

function XGlyph({ color, opacity }: { color: string; opacity: number }) {
    return (
        <group position={[0, 0, GLYPH_OFFSET]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.72, 0.16, 0.1]} />
                {glyphMaterial(color, opacity)}
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.72, 0.16, 0.1]} />
                {glyphMaterial(color, opacity)}
            </mesh>
        </group>
    );
}

function OGlyph({ color, opacity }: { color: string; opacity: number }) {
    return (
        <mesh position={[0, 0, GLYPH_OFFSET]}>
            <torusGeometry args={[0.29, 0.1, 20, 40]} />
            {glyphMaterial(color, opacity)}
        </mesh>
    );
}

function TriangleGlyph({ color, opacity }: { color: string; opacity: number }) {
    const shape = useMemo(() => {
        const outerR = 0.36;
        const innerR = 0.20;
        const s = new THREE.Shape();
        for (let i = 0; i < 3; i++) {
            const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
            const x = outerR * Math.cos(a);
            const y = outerR * Math.sin(a);
            if (i === 0) { s.moveTo(x, y); } else { s.lineTo(x, y); }
        }
        s.closePath();
        const hole = new THREE.Path();
        for (let i = 2; i >= 0; i--) {
            const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
            const x = innerR * Math.cos(a);
            const y = innerR * Math.sin(a);
            if (i === 2) { hole.moveTo(x, y); } else { hole.lineTo(x, y); }
        }
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, -0.02, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity)}
        </mesh>
    );
}

function SquareGlyph({ color, opacity }: { color: string; opacity: number }) {
    const shape = useMemo(() => {
        const outer = 0.28;
        const inner = 0.18;
        const s = new THREE.Shape();
        s.moveTo(-outer, -outer);
        s.lineTo( outer, -outer);
        s.lineTo( outer,  outer);
        s.lineTo(-outer,  outer);
        s.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-inner, -inner);
        hole.lineTo(-inner,  inner);
        hole.lineTo( inner,  inner);
        hole.lineTo( inner, -inner);
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity)}
        </mesh>
    );
}

function PlusGlyph({ color, opacity }: { color: string; opacity: number }) {
    // Two perpendicular bars — same boxGeometry dims as X but without the
    // π/4 rotation, so the silhouette is a clean cross.
    return (
        <group position={[0, 0, GLYPH_OFFSET]}>
            <mesh>
                <boxGeometry args={[0.66, 0.17, 0.1]} />
                {glyphMaterial(color, opacity)}
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.66, 0.17, 0.1]} />
                {glyphMaterial(color, opacity)}
            </mesh>
        </group>
    );
}

function HexagonGlyph({ color, opacity }: { color: string; opacity: number }) {
    const shape = useMemo(() => {
        const outerR = 0.34;
        const innerR = 0.22;
        const s = new THREE.Shape();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const x = outerR * Math.cos(a);
            const y = outerR * Math.sin(a);
            if (i === 0) { s.moveTo(x, y); } else { s.lineTo(x, y); }
        }
        s.closePath();
        const hole = new THREE.Path();
        for (let i = 5; i >= 0; i--) {
            const a = (i * Math.PI) / 3;
            const x = innerR * Math.cos(a);
            const y = innerR * Math.sin(a);
            if (i === 5) { hole.moveTo(x, y); } else { hole.lineTo(x, y); }
        }
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity)}
        </mesh>
    );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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
