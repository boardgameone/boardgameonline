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
import { Environment, Html, OrbitControls } from '@react-three/drei';
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
    0: 'TOP',
    1: 'BOT',
    2: 'LEFT',
    3: 'RIGHT',
    4: 'FRONT',
    5: 'BACK',
};

const FACE_LABEL_COLORS: Record<Face, { bg: string; text: string; ring: string }> = {
    0: { bg: 'bg-teal-50', text: 'text-teal-800', ring: 'ring-teal-300' },
    1: { bg: 'bg-purple-50', text: 'text-purple-800', ring: 'ring-purple-300' },
    2: { bg: 'bg-emerald-50', text: 'text-emerald-800', ring: 'ring-emerald-300' },
    3: { bg: 'bg-sky-50', text: 'text-sky-800', ring: 'ring-sky-300' },
    4: { bg: 'bg-pink-50', text: 'text-pink-800', ring: 'ring-pink-300' },
    5: { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-300' },
};

export type StickerClickHandler = (face: number, row: number, col: number) => void;

export interface CubeSceneHandle {
    /** Queue a rotation animation. Resolves when this specific move finishes. */
    playMove: (move: Move) => Promise<void>;
}

interface CubeSceneProps {
    marks: Marks;
    winningIndices?: Set<number>;
    onStickerClick?: StickerClickHandler;
    interactive: boolean;
}

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
    { marks, winningIndices, onStickerClick, interactive },
    ref,
) {
    const [displayedMarks, setDisplayedMarks] = useState<Marks>(marks);
    const [animation, setAnimation] = useState<Animation | null>(null);
    const queueRef = useRef<Array<{ move: Move; resolve: () => void }>>([]);
    const isAnimatingRef = useRef(false);
    const marksRef = useRef(marks);

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
                    animation={animation}
                    onAnimationComplete={onAnimationComplete}
                    winningIndices={winningIndices}
                    onStickerClick={interactive ? onStickerClick : undefined}
                />
            </Suspense>

            <OrbitControls
                makeDefault
                enablePan={false}
                minDistance={5.8}
                maxDistance={11}
                minPolarAngle={Math.PI * 0.18}
                maxPolarAngle={Math.PI * 0.82}
                rotateSpeed={0.7}
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
    animation: Animation | null;
    onAnimationComplete: () => void;
    winningIndices?: Set<number>;
    onStickerClick?: StickerClickHandler;
}

const CubeRoot = memo(function CubeRoot({
    marks,
    animation,
    onAnimationComplete,
    winningIndices,
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
        const isWinning = winningIndices?.has(idx) ?? false;
        return (
            <Sticker
                key={`sticker-${idx}`}
                face={s.face}
                row={s.row}
                col={s.col}
                mark={mark}
                isWinning={isWinning}
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
                <RotatingLayer animation={animation} onComplete={onAnimationComplete}>
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
                className={`pointer-events-none rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] shadow-md ring-2 ring-white ${colors.bg} ${colors.text}`}
                style={{
                    transform: 'translate(-50%, -50%)',
                    whiteSpace: 'nowrap',
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
                color="#1e2a44"
                metalness={0.15}
                roughness={0.35}
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
// Sticker — a flat plate on a cubie's face, with optional X/O glyph
// -----------------------------------------------------------------------------

interface StickerProps {
    face: Face;
    row: number;
    col: number;
    mark: Mark;
    isWinning: boolean;
    onClick?: StickerClickHandler;
}

const STICKER_SIZE = 0.84;
const STICKER_OFFSET = 0.49;
const GLYPH_OFFSET = 0.06;

function Sticker({ face, row, col, mark, isWinning, onClick }: StickerProps) {
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
        if (!onClick || mark !== null) return;
        e.stopPropagation();
        onClick(face, row, col);
    };

    const stickerColor = isWinning
        ? mark === 'X'
            ? '#fff1e6'
            : '#e6f0ff'
        : mark === null
            ? '#f8fafc'
            : '#ffffff';
    const emissive = isWinning ? (mark === 'X' ? '#ff7a4d' : '#5fb3ff') : '#000000';
    const emissiveIntensity = isWinning ? 0.9 : 0;

    return (
        <group position={position} rotation={rotation}>
            <mesh onClick={handleClick}>
                <planeGeometry args={[STICKER_SIZE, STICKER_SIZE]} />
                <meshStandardMaterial
                    color={stickerColor}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                    metalness={0.25}
                    roughness={0.35}
                />
            </mesh>

            {/* Thin frame */}
            <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE)]} />
                <lineBasicMaterial color="#1e2a44" transparent opacity={0.25} />
            </lineSegments>

            {mark !== null && <MarkGlyph mark={mark} />}
        </group>
    );
}

// -----------------------------------------------------------------------------
// MarkGlyph — extruded X or O, positioned slightly above the sticker
// -----------------------------------------------------------------------------

function MarkGlyph({ mark }: { mark: 'X' | 'O' }) {
    if (mark === 'X') return <XGlyph />;
    return <OGlyph />;
}

function XGlyph() {
    const color = '#ef4444'; // red-500
    const emissive = '#ff6b6b';
    return (
        <group position={[0, 0, GLYPH_OFFSET]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.68, 0.13, 0.07]} />
                <meshStandardMaterial
                    color={color}
                    emissive={emissive}
                    emissiveIntensity={0.55}
                    metalness={0.4}
                    roughness={0.25}
                />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.68, 0.13, 0.07]} />
                <meshStandardMaterial
                    color={color}
                    emissive={emissive}
                    emissiveIntensity={0.55}
                    metalness={0.4}
                    roughness={0.25}
                />
            </mesh>
        </group>
    );
}

function OGlyph() {
    const color = '#2563eb'; // blue-600
    const emissive = '#60a5fa';
    return (
        <mesh position={[0, 0, GLYPH_OFFSET]}>
            <torusGeometry args={[0.27, 0.08, 20, 40]} />
            <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={0.55}
                metalness={0.4}
                roughness={0.25}
            />
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
