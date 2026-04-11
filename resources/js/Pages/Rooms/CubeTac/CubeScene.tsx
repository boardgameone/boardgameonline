/**
 * The 3D CubeTac cube scene (React Three Fiber).
 *
 * Light-theme variant: transparent canvas background so the parent page's
 * gradient shows through, bright lighting, soft matte cubies with glowing
 * X/O glyphs that read well against a light backdrop.
 *
 * No rotation animation in V1 — marks snap to new positions when the
 * `marks` prop updates. A rotation is visually communicated by the move
 * counter and turn banner outside the canvas.
 */

import { Canvas, ThreeEvent } from '@react-three/fiber';
import { Environment, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Suspense, memo, useMemo } from 'react';
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
    faceNormal,
    indexOf,
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

interface CubeSceneProps {
    marks: Marks;
    winningIndices?: Set<number>;
    onStickerClick?: StickerClickHandler;
    interactive: boolean;
}

export default function CubeScene({ marks, winningIndices, onStickerClick, interactive }: CubeSceneProps) {
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
                    marks={marks}
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
}

// -----------------------------------------------------------------------------
// CubeRoot — renders all 27 cubies + their visible stickers
// -----------------------------------------------------------------------------

interface CubeRootProps {
    marks: Marks;
    winningIndices?: Set<number>;
    onStickerClick?: StickerClickHandler;
}

const CubeRoot = memo(function CubeRoot({ marks, winningIndices, onStickerClick }: CubeRootProps) {
    const stickers = useMemo(() => collectStickers(), []);
    const faces: Face[] = [0, 1, 2, 3, 4, 5];

    return (
        <group>
            {allCubiePositions().map(([x, y, z]) => (
                <Cubie key={`cubie-${x}-${y}-${z}`} position={[x, y, z]} />
            ))}

            {stickers.map((s) => {
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
            })}

            {faces.map((f) => (
                <FaceLabel key={`label-${f}`} face={f} />
            ))}
        </group>
    );
});

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
